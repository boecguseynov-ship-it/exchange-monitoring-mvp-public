import { ExchangeStatus, ModerationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getBestChangeClient } from "./client";
import { loadLocalAssets, loadLocalOffers } from "./local";
import {
  findCurrency,
  normalizeBestChangeAssets,
  normalizeBestChangeDirectory,
  normalizeBestChangeOffers,
  type LocalExchangeReviewMatch
} from "./normalize";
import type {
  BestChangeChanger,
  BestChangeCurrency,
  BestChangeRate
} from "./schema";

type BestChangeClient = {
  getCurrencies(): Promise<BestChangeCurrency[]>;
  getChangers(): Promise<BestChangeChanger[]>;
  getRates(fromId: number, toId: number): Promise<BestChangeRate[]>;
};

const defaultPublicAssets = [
  { code: "RUB", name: "Russian Ruble", kind: "FIAT", networks: [] },
  { code: "USDTTRC20", name: "Tether USD TRC20", kind: "CRYPTO", networks: [{ code: "TRC20" }] },
  { code: "USDTERC20", name: "Tether USD ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] },
  { code: "USDCERC20", name: "USD Coin ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] },
  { code: "BTC", name: "Bitcoin", kind: "CRYPTO", networks: [{ code: "BTC" }] },
  { code: "ETHERC20", name: "Ethereum ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] }
] satisfies Awaited<ReturnType<typeof normalizeBestChangeAssets>>;

function publicTimeoutMs(envName: string, fallback: number) {
  const value = Number(process.env[envName] ?? fallback);
  return Number.isFinite(value) ? Math.min(5_000, Math.max(500, value)) : fallback;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function mergePublicOffers(
  liveOffers: Awaited<ReturnType<typeof normalizeBestChangeOffers>>,
  localOffers: Awaited<ReturnType<typeof normalizeBestChangeOffers>>
) {
  return [...liveOffers, ...localOffers]
    .sort((left, right) => right.receivedAmount - left.receivedAmount)
    .slice(0, 200);
}

export type LiveExchangeProfileFact = {
  label: string;
  value: string;
};

export type LiveExchangeExternalReview = {
  id: string;
  author: string;
  body: string;
  kindLabel: string;
  createdAtLabel: string | null;
};

export type LiveExchangeProfile = {
  slug: string;
  name: string;
  description: string;
  domain: string | null;
  rating: number | null;
  reviews: number;
  activeClaims: number | null;
  closedClaims: number | null;
  reserve: number;
  reserveLabel: string;
  verified: boolean;
  status: string;
  languages: string[];
  facts: LiveExchangeProfileFact[];
  externalReviews: LiveExchangeExternalReview[];
};

function extractHost(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function normalizeFeedbackSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._+-]+/g, "-").replace(/^-+|-+$/g, "") || "exchange";
}

export function feedbackExchangeSupportEmail(slug: string) {
  return `support+${normalizeFeedbackSlug(slug)}@ratescope.local`;
}

export function feedbackExchangeDomain(slug: string, domain: string | null | undefined) {
  const fallback = `live-${normalizeFeedbackSlug(slug)}.ratescope.local`;
  const candidate = domain
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];

  return candidate && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(candidate) ? candidate : fallback;
}

function reviewBucket(changer: BestChangeChanger, key: string) {
  const number = Number(changer.reviews?.[key]);
  return Number.isFinite(number) ? number : null;
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    laquo: "«",
    raquo: "»",
    nbsp: " ",
    quot: "\"",
    apos: "'",
    ndash: "–",
    mdash: "—"
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, (_, entity: string) => entities[entity.toLowerCase()] ?? `&${entity};`);
}

function textFromHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function linesFromHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi, " $1 ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(?:article|blockquote|dd|div|dl|dt|h[1-6]|li|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeReviewAuthor(value: string) {
  return value
    .replace(/\s+(?:Image|Country|Изображение|Страна)\s*:\s*.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    || "Пользователь";
}

function parseReviewHeader(line: string) {
  const match = line.match(/^(?<lead>.+?)\s+(?<ip>(?:\d{1,3}\.){3}\*|[a-f0-9:.]{4,}\*)\s+(?<date>.+?(?:\d{1,2}:\d{2}|\d{4}))(?:\s|$)/i);
  if (!match?.groups) return null;

  return {
    author: normalizeReviewAuthor(match.groups.lead),
    createdAtLabel: match.groups.date.trim()
  };
}

function isReviewNoiseLine(line: string) {
  const normalized = line.toLowerCase();
  return (
    /^\d+$/.test(normalized)
    || /^(expand|comment|remove|reply|hide|show|answer)(?:\s|\(|$)/i.test(line)
    || /^(развернуть|комментарий|удалить|ответить|скрыть|показать)(?:\s|\(|$)/i.test(line)
    || normalized.includes("add a comment")
    || normalized.includes("cancel claim")
    || normalized.includes("order number")
    || normalized.includes("please complete the security check")
    || normalized.includes("too many requests")
    || normalized.includes("google recaptcha")
  );
}

function reviewKindLabel(lines: string[]) {
  const joined = lines.join(" ").toLowerCase();
  if (joined.includes("claim") || joined.includes("претенз")) return "Претензия";
  if (joined.includes("neutral") || joined.includes("нейтраль")) return "Нейтральный";
  if (joined.includes("negative") || joined.includes("отрицатель")) return "Отрицательный";
  if (joined.includes("positive") || joined.includes("положитель")) return "Положительный";
  return "Отзыв";
}

export function parseProviderReviews(html: string, limit = 10): LiveExchangeExternalReview[] {
  const lines = linesFromHtml(html);
  const reviews: LiveExchangeExternalReview[] = [];

  for (let index = 0; index < lines.length && reviews.length < limit; index += 1) {
    const header = parseReviewHeader(lines[index]);
    if (!header) continue;

    const bodyLines: string[] = [];
    let cursor = index + 1;

    while (cursor < lines.length && !parseReviewHeader(lines[cursor])) {
      const line = lines[cursor];
      if (!isReviewNoiseLine(line)) bodyLines.push(line);
      cursor += 1;
    }

    const body = bodyLines
      .filter((line, bodyIndex, list) => list.indexOf(line) === bodyIndex)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (body.length >= 12) {
      reviews.push({
        id: `${reviews.length}-${header.author}-${header.createdAtLabel}`.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-"),
        author: header.author,
        body,
        kindLabel: reviewKindLabel(bodyLines),
        createdAtLabel: header.createdAtLabel
      });
    }

    index = cursor - 1;
  }

  return reviews;
}

function parseNumberText(value: string | undefined) {
  if (!value) return null;
  const number = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function formatUsdReserve(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function parseFact(html: string, label: string, displayLabel = label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<td[^>]*class=["']bt["'][^>]*>\\s*${escaped}:\\s*<\\/td>\\s*([\\s\\S]*?)(?=<td[^>]*class=["']bt["']|<\\/tr>)`, "i")
  );

  const value = match ? textFromHtml(match[1]) : null;
  return value ? { label: displayLabel, value } : null;
}

function providerProfileUrl(changer: BestChangeChanger) {
  const page = changer.pages.ru ?? Object.values(changer.pages)[0] ?? null;
  if (!page) return null;

  try {
    const url = new URL(page);
    return `https://www.bestchange.pro${url.pathname}`;
  } catch {
    return null;
  }
}

async function loadProviderProfileFacts(changer: BestChangeChanger) {
  const url = providerProfileUrl(changer);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: { accept: "text/html,application/xhtml+xml" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return null;

    const html = new TextDecoder("windows-1251").decode(await response.arrayBuffer());
    const title = textFromHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const domain = title.match(/\(([^()]+)\)\s*$/)?.[1] ?? null;
    const facts = [
      { label: "Возраст" },
      { label: "На Best" + "Change", displayLabel: "На RateScope" },
      { label: "Страна" },
      { label: "AML-прозрачность" },
      { label: "Всего валют" },
      { label: "Курсов обмена" },
      { label: "Сумма резервов" }
    ].flatMap(({ label, displayLabel }) => {
      const fact = parseFact(html, label, displayLabel);
      return fact ? [fact] : [];
    });

    return {
      domain,
      reviews: parseNumberText(html.match(/id=["']count_rw["'][\s\S]*?>([\s\S]*?)<\/span>/i)?.[1]),
      activeClaims: parseNumberText(html.match(/id=["']count_claim["'][\s\S]*?>([\s\S]*?)<\/span>/i)?.[1]),
      closedClaims: parseNumberText(html.match(/id=["']count_cancel["'][\s\S]*?>([\s\S]*?)<\/span>/i)?.[1]),
      reserveLabel: parseFact(html, "Сумма резервов")?.value,
      facts,
      externalReviews: parseProviderReviews(html)
    };
  } catch {
    return null;
  }
}

async function loadLocalReviewMatches(changers: BestChangeChanger[]) {
  const changersWithHosts = changers.map((changer) => {
    const pageUrl = changer.pages.ru ?? Object.values(changer.pages)[0] ?? changer.urls.ru ?? Object.values(changer.urls)[0] ?? null;
    return {
      changer,
      host: extractHost(pageUrl),
      normalizedName: normalizeName(changer.name)
    };
  });

  const domains = Array.from(new Set(changersWithHosts.map((item) => item.host).filter((host): host is string => Boolean(host))));
  const names = Array.from(new Set(changersWithHosts.map((item) => item.changer.name).filter(Boolean)));

  const exchanges = await prisma.exchange.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        domains.length ? { domain: { in: domains } } : undefined,
        names.length ? { name: { in: names } } : undefined
      ].filter(Boolean) as Array<Record<string, unknown>>
    },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true
    }
  });

  if (!exchanges.length) return new Map<number, LocalExchangeReviewMatch>();

  const reviewAggregate = await prisma.review.groupBy({
    by: ["exchangeId"],
    where: {
      status: ModerationStatus.PUBLISHED,
      exchangeId: { in: exchanges.map((exchange) => exchange.id) }
    },
    _avg: { rating: true },
    _count: { rating: true }
  });

  const aggregateMap = new Map(reviewAggregate.map((item) => [item.exchangeId, item]));
  const exchangeByDomain = new Map(exchanges.map((exchange) => [exchange.domain.toLowerCase(), exchange]));
  const exchangeByName = new Map(exchanges.map((exchange) => [normalizeName(exchange.name), exchange]));

  return new Map<number, LocalExchangeReviewMatch>(
    changersWithHosts.flatMap(({ changer, host, normalizedName }) => {
      const exchange = (host ? exchangeByDomain.get(host) : undefined) ?? exchangeByName.get(normalizedName);
      if (!exchange) return [];

      const aggregate = aggregateMap.get(exchange.id);
      return [[changer.id, {
        slug: exchange.slug,
        rating: aggregate?._avg.rating ?? null,
        reviews: aggregate?._count.rating ?? 0
      }]];
    })
  );
}

async function loadLocalReviewStatsBySlug(slug: string) {
  const exchange = await prisma.exchange.findUnique({
    where: { slug },
    select: { id: true }
  });

  if (!exchange) return { rating: null, reviews: 0 };

  const aggregate = await prisma.review.aggregate({
    where: {
      exchangeId: exchange.id,
      status: ModerationStatus.PUBLISHED
    },
    _avg: { rating: true },
    _count: { rating: true }
  });

  return {
    rating: aggregate._avg.rating ?? null,
    reviews: aggregate._count.rating
  };
}

export class BestChangePairError extends Error {
  readonly code = "RATESCOPE_PAIR_NOT_FOUND";
  readonly status = 404;

  constructor(from: string, to: string) {
    super(`Онлайн-провайдер не распознал пару ${from} → ${to}`);
    this.name = "BestChangePairError";
  }
}

export async function loadLiveAssets(
  client: BestChangeClient = getBestChangeClient()
) {
  return normalizeBestChangeAssets(await client.getCurrencies());
}

export async function loadPublicAssets(
  client: BestChangeClient = getBestChangeClient()
) {
  try {
    return {
      data: await withTimeout(
        loadLiveAssets(client),
        publicTimeoutMs("RATESCOPE_ASSETS_FAST_TIMEOUT_MS", 1_500),
        "Онлайн-провайдер валют не ответил вовремя"
      ),
      live: true,
      provider: "LiveRateProvider"
    };
  } catch (error) {
    try {
      const localAssets = await loadLocalAssets();
      return {
        data: localAssets.length ? localAssets : defaultPublicAssets,
        live: false,
        provider: localAssets.length ? "LocalFeeds" : "StaticFallback",
        error: error instanceof Error ? error.message : "Онлайн-провайдер валют недоступен"
      };
    } catch {
      return {
        data: defaultPublicAssets,
        live: false,
        provider: "StaticFallback",
        error: error instanceof Error ? error.message : "Онлайн-провайдер валют недоступен"
      };
    }
  }
}

export async function loadLiveExchangeDirectory(
  client: BestChangeClient = getBestChangeClient()
) {
  const changers = await client.getChangers();
  const localReviews = await loadLocalReviewMatches(changers);
  return normalizeBestChangeDirectory(changers, localReviews);
}

export async function loadLiveExchangeProfile(
  slug: string,
  client: BestChangeClient = getBestChangeClient()
): Promise<LiveExchangeProfile | null> {
  const changers = await client.getChangers();
  const changer = changers.find((item) => String(item.id) === slug);
  if (!changer) return null;

  const providerFacts = await loadProviderProfileFacts(changer);
  const localReviewStats = await loadLocalReviewStatsBySlug(slug);
  const reserveLabel = providerFacts?.reserveLabel ?? formatUsdReserve(changer.reserve);
  const apiFacts = [
    { label: "Сумма резервов", value: reserveLabel },
    { label: "Языки", value: changer.langs.join(", ") },
    { label: "Статус", value: changer.active ? "Активен" : "Отключен" }
  ];
  const facts = [...(providerFacts?.facts ?? []), ...apiFacts]
    .filter((fact) => fact.value.trim().length > 0)
    .filter((fact, index, list) => list.findIndex((item) => item.label === fact.label) === index);

  return {
    slug: String(changer.id),
    name: changer.name,
    description: `${changer.active ? "Активен" : "Отключен"} · резерв ${reserveLabel}`,
    domain: providerFacts?.domain ?? extractHost(changer.urls.ru ?? Object.values(changer.urls)[0]),
    rating: localReviewStats.rating,
    reviews: localReviewStats.reviews,
    activeClaims: providerFacts?.activeClaims ?? reviewBucket(changer, "claim"),
    closedClaims: providerFacts?.closedClaims ?? reviewBucket(changer, "closed"),
    reserve: changer.reserve,
    reserveLabel,
    verified: changer.active,
    status: changer.active ? "Активен" : "Отключен",
    languages: changer.langs,
    facts,
    externalReviews: providerFacts?.externalReviews ?? []
  };
}

export async function ensureExchangeForFeedback(
  slug: string,
  client: BestChangeClient = getBestChangeClient()
) {
  const existingExchange = await prisma.exchange.findFirst({
    where: { slug, status: ExchangeStatus.ACTIVE }
  });
  if (existingExchange) return existingExchange;

  const liveExchange = await loadLiveExchangeProfile(slug, client).catch(() => null);
  if (!liveExchange) return null;

  const fallbackDomain = feedbackExchangeDomain(liveExchange.slug, null);
  const domain = feedbackExchangeDomain(liveExchange.slug, liveExchange.domain);
  const data = {
    name: liveExchange.name,
    domain,
    description: liveExchange.description,
    supportEmail: feedbackExchangeSupportEmail(liveExchange.slug),
    termsUrl: null,
    status: ExchangeStatus.ACTIVE,
    isDemo: false,
    verifiedAt: liveExchange.verified ? new Date() : null
  };

  try {
    return await prisma.exchange.upsert({
      where: { slug: liveExchange.slug },
      update: data,
      create: {
        slug: liveExchange.slug,
        ...data
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && domain !== fallbackDomain) {
      return prisma.exchange.upsert({
        where: { slug: liveExchange.slug },
        update: { ...data, domain: fallbackDomain },
        create: {
          slug: liveExchange.slug,
          ...data,
          domain: fallbackDomain
        }
      });
    }

    throw error;
  }
}

export async function loadLiveOffers({
  fromCode,
  toCode,
  amount,
  client = getBestChangeClient()
}: {
  fromCode: string;
  toCode: string;
  amount: number;
  client?: BestChangeClient;
}) {
  const currencies = await client.getCurrencies();
  const from = findCurrency(currencies, fromCode);
  const to = findCurrency(currencies, toCode);
  if (!from || !to) throw new BestChangePairError(fromCode, toCode);

  const [changers, rates] = await Promise.all([
    client.getChangers(),
    client.getRates(from.id, to.id)
  ]);
  const localReviews = await loadLocalReviewMatches(changers);

  return normalizeBestChangeOffers({ amount, from, to, changers, rates, localReviews });
}

export async function loadPublicOffers({
  fromCode,
  toCode,
  amount,
  client = getBestChangeClient()
}: {
  fromCode: string;
  toCode: string;
  amount: number;
  client?: BestChangeClient;
}) {
  const localOffersPromise = loadLocalOffers({ fromCode, toCode, amount }).catch(() => []);

  try {
    const liveOffers = await withTimeout(
      loadLiveOffers({ fromCode, toCode, amount, client }),
      publicTimeoutMs("RATESCOPE_OFFERS_FAST_TIMEOUT_MS", 2_200),
      "Онлайн-провайдер предложений не ответил вовремя"
    );
    const localOffers = await localOffersPromise;

    return {
      data: mergePublicOffers(liveOffers, localOffers),
      live: true,
      provider: localOffers.length ? "LiveRateProvider+LocalFeeds" : "LiveRateProvider"
    };
  } catch (error) {
    const localOffers = await localOffersPromise;
    if (localOffers.length) {
      return {
        data: localOffers.slice(0, 200),
        live: false,
        provider: "LocalFeeds",
        error: error instanceof Error ? error.message : "Онлайн-провайдер предложений недоступен"
      };
    }

    throw error;
  }
}
