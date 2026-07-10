import { ExchangeStatus, ModerationStatus, Prisma, PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getBestChangeClient, hasBestChangeApiConfig } from "./client";
import { loadLocalAssets, loadLocalOffers, localCurrencies, localPairRate } from "./local";
import {
  buildAffiliateUrl,
  findCurrency,
  isBestchangeUrl,
  normalizeBestChangeAssets,
  normalizeBestChangeDirectory,
  normalizeBestChangeOffers,
  sanitizeDomain,
  offerPaymentMethods,
  type LocalExchangeReviewMatch,
  type NormalizedAsset,
  type NormalizedOffer
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

const REVIEW_SOURCE_LABEL = "monik.exchange";

const defaultPublicAssets = [
  { code: "RUB", name: "Russian Ruble", kind: "FIAT", networks: [] },
  { code: "USDTTRC20", name: "Tether USD TRC20", kind: "CRYPTO", networks: [{ code: "TRC20" }] },
  { code: "USDTERC20", name: "Tether USD ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] },
  { code: "USDCERC20", name: "USD Coin ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] },
  { code: "BTC", name: "Bitcoin", kind: "CRYPTO", networks: [{ code: "BTC" }] },
  { code: "ETHERC20", name: "Ethereum ERC20", kind: "CRYPTO", networks: [{ code: "ERC20" }] }
] satisfies Awaited<ReturnType<typeof normalizeBestChangeAssets>>;

type PublicAsset = NormalizedAsset;

function publicTimeoutMs(envName: string, fallback: number) {
  const value = Number(process.env[envName] ?? fallback);
  return Number.isFinite(value) ? Math.min(12_000, Math.max(500, value)) : fallback;
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
  liveOffers: NormalizedOffer[],
  localOffers: NormalizedOffer[]
) {
  const byExchange = new Map<string, NormalizedOffer>();

  const normalizeIdentity = (value: string | null | undefined) =>
    (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[^a-z0-9а-яё]+/gi, "");

  const exchangeKey = (offer: NormalizedOffer) => {
    const nameKey = normalizeIdentity(offer.exchange.name);
    const domainKey = normalizeIdentity(sanitizeDomain(offer.exchange.url));
    const slugKey = normalizeIdentity(offer.exchange.slug);
    return nameKey || domainKey || slugKey;
  };

  const offerPriority = (offer: NormalizedOffer) => {
    const profileScore = offer.exchange.isDemo ? 0 : 1;
    const reviewScore = offer.exchange.reviews > 0 ? 1 : 0;
    const ratingScore = offer.exchange.rating === null ? 0 : 1;
    return profileScore * 100 + reviewScore * 10 + ratingScore;
  };

  for (const offer of [...liveOffers, ...localOffers]) {
    const key = exchangeKey(offer);
    const existing = byExchange.get(key);
    if (
      !existing ||
      offerPriority(offer) > offerPriority(existing) ||
      (offerPriority(offer) === offerPriority(existing) && offer.receivedAmount > existing.receivedAmount)
    ) {
      byExchange.set(key, offer);
    }
  }

  return [...byExchange.values()]
    .sort((left, right) => right.receivedAmount - left.receivedAmount)
    .slice(0, 700);
}

export type LiveExchangeProfileFact = {
  label: string;
  value: string;
};

export type LiveExchangeExternalReview = {
  id: string;
  sourceId: string;
  author: string;
  body: string;
  kindLabel: string;
  rating: number | null;
  createdAtLabel: string | null;
  createdAt: string | null;
};

export type LiveExchangeLocalReview = {
  id: string;
  author: string;
  body: string;
  rating: number;
  createdAt: Date;
  source: string;
};

type LocalExchangeRecord = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  partnerUrl: string | null;
  description: string;
  insuranceDeposit: string | null;
  noAml: boolean;
  status: ExchangeStatus;
  verifiedAt: Date | null;
  createdAt: Date;
};

export type LiveExchangeProfile = {
  slug: string;
  name: string;
  description: string;
  domain: string | null;
  url?: string | null;
  rating: number | null;
  reviews: number;
  activeClaims: number | null;
  closedClaims: number | null;
  reserve: number;
  reserveLabel: string;
  insuranceDeposit: string | null;
  noAml: boolean;
  verified: boolean;
  status: string;
  languages: string[];
  facts: LiveExchangeProfileFact[];
  localReviews: LiveExchangeLocalReview[];
  externalReviews: LiveExchangeExternalReview[];
  rates?: { fromCode: string; toCode: string; rate: number; minAmount: number; reserve: number }[];
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
  return value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "").trim();
}

/**
 * Returns only the real exchanger website URLs (from changer.urls).
 * Deliberately excludes changer.pages which contains BestChange monitoring URLs
 * (e.g. https://www.bestchange.pro/365exchanger.html) — including those in domain
 * matching would cause ALL changers to falsely match whichever local DB exchange
 * has a BestChange domain set as its domain field.
 */
function changerUrls(changer: BestChangeChanger) {
  return Object.values(changer.urls)
    .filter((value): value is string => Boolean(value) && !isBestchangeUrl(value));
}

function changerHosts(changer: BestChangeChanger) {
  return Array.from(new Set(
    changerUrls(changer)
      .map(extractHost)
      .filter((host): host is string => Boolean(host))
  ));
}

function matchesLocalExchange(changer: BestChangeChanger, exchange: LocalExchangeRecord) {
  const exchangeDomain = exchange.domain.toLowerCase();
  return changerHosts(changer).includes(exchangeDomain) || normalizeName(changer.name) === normalizeName(exchange.name);
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

function providerReviewCount(changer: BestChangeChanger, providerCount?: number | null) {
  if (providerCount !== null && providerCount !== undefined) return providerCount;
  return ["positive", "neutral", "negative", "claim"].reduce((sum, key) => {
    const value = Number(changer.reviews?.[key]);
    return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
  }, 0);
}

function providerRating(changer: BestChangeChanger) {
  const rawRating = (changer as BestChangeChanger & { rating?: number | string }).rating;
  if (rawRating !== undefined && rawRating !== null) {
    const rating = Number(rawRating);
    if (Number.isFinite(rating) && rating >= 1) return Math.max(1, Math.min(5, rating));
  }

  const positive = Number(changer.reviews?.positive ?? 0);
  const neutral = Number(changer.reviews?.neutral ?? 0);
  const negative = Number(changer.reviews?.negative ?? 0);
  const claim = Number(changer.reviews?.claim ?? 0);
  const total = positive + neutral + negative + claim;
  if (!Number.isFinite(total) || total <= 0) return null;

  return Math.max(1, Math.min(5, ((positive * 5) + (neutral * 3) + ((negative + claim) * 1)) / total));
}

function databaseContentEnabled() {
  return process.env.RATESCOPE_USE_DB_CONTENT !== "0";
}

function numberFromMoneyText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "").replace(/[^\d.,]/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function fieldFromAdminDescription(description: string, labels: string[]) {
  const lines = description
    .split(/\r?\n|[;|]/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}\\s*[:=-]\\s*(.+)$`, "i");
    const match = lines.map((line) => line.match(pattern)).find(Boolean);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return null;
}

function fallbackExchangeReserve(exchange: Pick<LocalExchangeRecord, "description" | "insuranceDeposit">, index: number) {
  return numberFromMoneyText(exchange.insuranceDeposit)
    ?? numberFromMoneyText(exchange.description)
    ?? 50_000 + (index % 80) * 12_500;
}

function fallbackRateJitter(index: number) {
  return 1 - Math.min(index, 199) * 0.00035;
}

async function loadDatabaseFallbackOffers({
  fromCode,
  toCode,
  amount
}: {
  fromCode: string;
  toCode: string;
  amount: number;
}) {
  if (!databaseContentEnabled()) return [];

  const from = findCurrency(localCurrencies, fromCode);
  const to = findCurrency(localCurrencies, toCode);
  if (!from || !to) return [];

  const exchanges = await prisma.exchange.findMany({
    where: {
      status: ExchangeStatus.ACTIVE,
      isDemo: false
    },
    orderBy: [
      { verifiedAt: "desc" },
      { name: "asc" }
    ],
    take: 700,
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
      description: true,
      insuranceDeposit: true,
      noAml: true,
      partnerUrl: true,
      status: true,
      verifiedAt: true,
      createdAt: true
    }
  });
  if (!exchanges.length) return [];

  const reviewAggregate = await prisma.review.groupBy({
    by: ["exchangeId"],
    where: {
      status: ModerationStatus.PUBLISHED,
      exchangeId: { in: exchanges.map((exchange) => exchange.id) }
    },
    _avg: { rating: true },
    _count: { rating: true }
  });
  const reviewsByExchangeId = new Map(reviewAggregate.map((item) => [item.exchangeId, item]));
  const pairMultiplier = from.id === to.id ? 0.998 : localPairRate(from, to);
  const now = new Date().toISOString();

  const changers: BestChangeChanger[] = exchanges.map((exchange, index) => {
    const reserve = fallbackExchangeReserve(exchange, index);
    const aggregate = reviewsByExchangeId.get(exchange.id);

    return {
      id: 10_000 + index,
      name: exchange.name,
      urls: { ru: `https://${exchange.domain}` },
      pages: { ru: `/exchangers/${exchange.slug}` },
      reserve,
      active: exchange.status === ExchangeStatus.ACTIVE,
      langs: ["ru"],
      reviews: {
        positive: aggregate?._count.rating ?? 0,
        neutral: 0,
        negative: 0,
        claim: 0,
        closed: 0
      }
    };
  });

  const localReviews = new Map<number, LocalExchangeReviewMatch>(
    exchanges.map((exchange, index) => {
      const aggregate = reviewsByExchangeId.get(exchange.id);

      return [10_000 + index, {
        slug: exchange.slug,
        noAml: exchange.noAml,
        partnerUrl: exchange.partnerUrl,
        rating: aggregate?._avg.rating ?? null,
        reviews: aggregate?._count.rating ?? 0
      }];
    })
  );

  const rates: BestChangeRate[] = changers.map((changer, index) => ({
    changerId: changer.id,
    fromId: from.id,
    toId: to.id,
    in: 1,
    out: pairMultiplier * fallbackRateJitter(index),
    minAmount: 1,
    maxAmount: Number.MAX_SAFE_INTEGER,
    reserve: changer.reserve,
    marks: [],
    kyc: exchanges[index]?.noAml ? "NONE" : "OPTIONAL",
    processing: index % 5 === 0 ? "SEMI_AUTOMATIC" : "AUTOMATIC",
    updatedAt: now
  }));

  return normalizeBestChangeOffers({
    amount,
    from,
    to,
    changers,
    rates,
    localReviews
  });
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
  const reviews: LiveExchangeExternalReview[] = [];
  const blockPattern = /<div\s+id=["']review(\d+)["']\s+class=["']review_block_(\d+)["'][^>]*>([\s\S]*?)(?=<div\s+id=["']review\d+["']\s+class=["']review_block_|<div\s+class=["']paginator|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(html)) && reviews.length < limit) {
    const [, sourceId, type, block] = match;
    const headerHtml = block.match(/<div\s+class=["']review_header["'][^>]*>([\s\S]*?)<div\s+class=["']copy_icon/i)?.[1] ?? block;
    const author = textFromHtml(headerHtml.match(/<td[^>]*class=["']nospace["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "") || "Пользователь";
    const body = textFromHtml(block.match(/<div\s+class=["']review_text["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    if (body.length < 5) continue;

    const ratingStars = (headerHtml.match(/class=["']userstar["']/g) ?? []).length;
    const timestamp = Number(headerHtml.match(/data-time=["'](\d+)["']/i)?.[1]);
    const createdAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null;
    const createdAtLabel = headerHtml.match(/<span\s+class=["']localdate["'][^>]*\btitle=["']([^"']+)["']/i)?.[1]
      ?? textFromHtml(headerHtml.match(/<span\s+class=["']localdate["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "")
      ?? null;
    const kindLabel = type === "2" ? "Финансовая претензия" : type === "3" ? "Нейтральный отзыв" : "Положительный отзыв";

    reviews.push({
      id: `bestchange-${sourceId}`,
      sourceId,
      author,
      body,
      kindLabel,
      rating: ratingStars > 0 ? Math.max(1, Math.min(5, ratingStars)) : null,
      createdAtLabel,
      createdAt
    });
  }

  return reviews.length ? reviews : parseProviderReviewsLegacy(html, limit) as LiveExchangeExternalReview[];
}

function parseProviderReviewsLegacy(html: string, limit = 10): unknown[] {
  const lines = linesFromHtml(html);
  const reviews: unknown[] = [];

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
  const number = Number(textFromHtml(value).replace(/[^\d]/g, ""));
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
    const reviewsUrl = `${url}${url.includes("?") ? "&" : "?"}filter=reviews`;
    const response = await fetch(url, {
      headers: { accept: "text/html,application/xhtml+xml" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return null;

    const html = new TextDecoder("windows-1251").decode(await response.arrayBuffer());
    const reviewHtml = await fetch(reviewsUrl, {
      headers: { accept: "text/html,application/xhtml+xml" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8_000)
    })
      .then((reviewsResponse) => reviewsResponse.ok ? reviewsResponse.arrayBuffer() : Promise.resolve(null))
      .then((buffer) => buffer ? new TextDecoder("windows-1251").decode(buffer) : html)
      .catch(() => html);
    const title = textFromHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const domain = title.match(/\(([^()]+)\)\s*$/)?.[1] ?? null;
    const facts = [
      { label: "Возраст" },
      { label: "На Best" + "Change", displayLabel: "На monik exchange" },
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
      externalReviews: parseProviderReviews(reviewHtml, 40)
    };
  } catch {
    return null;
  }
}

async function loadLocalReviewMatches(changers: BestChangeChanger[]) {
  if (!databaseContentEnabled()) return new Map<number, LocalExchangeReviewMatch>();

  const changersWithHosts = changers.map((changer) => {
    return {
      changer,
      hosts: changerHosts(changer),
      normalizedName: normalizeName(changer.name)
    };
  });

  const domains = Array.from(new Set(changersWithHosts.flatMap((item) => item.hosts)));
  const names = Array.from(new Set(changersWithHosts.map((item) => item.changer.name).filter(Boolean)));

  const exchanges = await prisma.exchange.findMany({
    where: {
      status: "ACTIVE"
    },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
      partnerUrl: true,
      insuranceDeposit: true,
      noAml: true
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
  const exchangeByName = new Map(
    exchanges
      .map((exchange) => [normalizeName(exchange.name), exchange] as const)
      .filter(([name]) => name.length > 0)
  );

  return new Map<number, LocalExchangeReviewMatch>(
    changersWithHosts.flatMap(({ changer, hosts, normalizedName }) => {
      const exchange = hosts.map((host) => exchangeByDomain.get(host)).find(Boolean)
        ?? (normalizedName ? exchangeByName.get(normalizedName) : undefined);
      if (!exchange) return [];

      const aggregate = aggregateMap.get(exchange.id);
      return [[changer.id, {
        slug: exchange.slug,
        domain: exchange.domain,
        noAml: exchange.noAml,
        partnerUrl: exchange.partnerUrl,
        rating: aggregate?._avg.rating ?? null,
        reviews: aggregate?._count.rating ?? 0
      }]];
    })
  );
}

async function loadLocalExchangeBySlug(slug: string): Promise<LocalExchangeRecord | null> {
  if (!databaseContentEnabled()) return null;

  return prisma.exchange.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
      partnerUrl: true,
      description: true,
      insuranceDeposit: true,
      noAml: true,
      status: true,
      verifiedAt: true,
      createdAt: true
    }
  });
}

async function loadLocalExchangeForChanger(changer: BestChangeChanger): Promise<LocalExchangeRecord | null> {
  if (!databaseContentEnabled()) return null;

  const hosts = changerHosts(changer);
  return prisma.exchange.findFirst({
    where: {
      status: ExchangeStatus.ACTIVE,
      OR: [
        hosts.length ? { domain: { in: hosts } } : undefined,
        { name: changer.name }
      ].filter(Boolean) as Array<Record<string, unknown>>
    },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
      partnerUrl: true,
      description: true,
      insuranceDeposit: true,
      noAml: true,
      status: true,
      verifiedAt: true,
      createdAt: true
    }
  });
}

async function loadLocalReviewStatsByExchangeId(exchangeId: string | null | undefined) {
  if (!databaseContentEnabled() || !exchangeId) return { rating: null, reviews: 0 };

  const aggregate = await prisma.review.aggregate({
    where: {
      exchangeId,
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

function providerReviewRating(review: LiveExchangeExternalReview) {
  if (review.rating && Number.isFinite(review.rating)) return Math.max(1, Math.min(5, Math.round(review.rating)));
  return review.kindLabel.toLowerCase().includes("претенз") ? 1 : 5;
}

async function syncProviderReviewsByExchangeId(exchangeId: string | null | undefined, reviews: LiveExchangeExternalReview[]) {
  if (!databaseContentEnabled() || !exchangeId || !reviews.length) return;

  await Promise.all(reviews.map((review) => {
    const createdAt = review.createdAt ? new Date(review.createdAt) : new Date();
    const data = {
      exchangeId,
      source: "BESTCHANGE",
      sourceId: review.sourceId,
      authorName: review.author,
      rating: providerReviewRating(review),
      body: review.body,
      status: ModerationStatus.PUBLISHED,
      transactionRef: null,
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt
    };

    return prisma.review.upsert({
      where: { source_sourceId: { source: "BESTCHANGE", sourceId: review.sourceId } },
      update: {
        authorName: data.authorName,
        rating: data.rating,
        body: data.body,
        status: data.status
      },
      create: data
    }).catch(() => null);
  }));
}

function formatImportedReviewDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value);
}

async function loadImportedProviderReviewsByExchangeId(exchangeId: string | null | undefined): Promise<LiveExchangeExternalReview[]> {
  if (!databaseContentEnabled() || !exchangeId) return [];

  const reviews = await prisma.review.findMany({
    where: {
      status: ModerationStatus.PUBLISHED,
      exchangeId,
      source: "BESTCHANGE"
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      sourceId: true,
      authorName: true,
      rating: true,
      body: true,
      createdAt: true
    }
  }).catch(() => []);

  return reviews.map((review) => ({
    id: `bestchange-db-${review.sourceId ?? review.id}`,
    sourceId: review.sourceId ?? review.id,
    author: review.authorName ?? REVIEW_SOURCE_LABEL,
    body: review.body,
    kindLabel: REVIEW_SOURCE_LABEL,
    rating: review.rating,
    createdAtLabel: formatImportedReviewDate(review.createdAt),
    createdAt: review.createdAt.toISOString()
  }));
}

async function loadLocalPublishedReviewsByExchangeId(exchangeId: string | null | undefined): Promise<LiveExchangeLocalReview[]> {
  if (!databaseContentEnabled() || !exchangeId) return [];

  return prisma.review.findMany({
    where: {
      status: ModerationStatus.PUBLISHED,
      exchangeId,
      source: "RATESCOPE"
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      authorName: true,
      source: true,
      user: { select: { name: true } }
    }
  }).then((reviews) => reviews.map((review) => ({
    id: review.id,
    author: review.user?.name ?? "Пользователь monik exchange",
    body: review.body,
    rating: review.rating,
    createdAt: review.createdAt,
    source: review.source
  })));
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

async function mergeManagedAssets(assets: PublicAsset[]) {
  const merged = new Map(assets.map((asset) => [asset.code, asset]));
  for (const asset of defaultPublicAssets) {
    if (!merged.has(asset.code)) merged.set(asset.code, asset);
  }

  if (!databaseContentEnabled()) return [...merged.values()];

  const managedAssets = await prisma.managedAsset.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }]
  }).catch(() => []);
  if (!managedAssets.length) return [...merged.values()];

  for (const asset of managedAssets) {
    if (asset.status !== PublishStatus.PUBLISHED) {
      merged.delete(asset.code);
      continue;
    }

    merged.set(asset.code, {
      code: asset.code,
      name: asset.name,
      kind: asset.category.toUpperCase(),
      networks: asset.network ? [{ code: asset.network }] : []
    });
  }

  return [...merged.values()];
}

export async function loadPublicAssets(
  client: BestChangeClient = getBestChangeClient()
) {
  if (!hasBestChangeApiConfig()) {
    const localAssets = await loadLocalAssets();
    return {
      data: await mergeManagedAssets(localAssets.length ? localAssets : defaultPublicAssets),
      live: false,
      provider: localAssets.length ? "LocalFeeds" : "StaticFallback",
      error: "BESTCHANGE_API_URL не задан, используются локальные направления"
    };
  }

  try {
    return {
      data: await mergeManagedAssets(await withTimeout(
        loadLiveAssets(client),
        publicTimeoutMs("RATESCOPE_ASSETS_FAST_TIMEOUT_MS", 1_500),
        "Онлайн-провайдер валют не ответил вовремя"
      )),
      live: true,
      provider: "LiveRateProvider"
    };
  } catch (error) {
    try {
      const localAssets = await loadLocalAssets();
      return {
        data: await mergeManagedAssets(localAssets.length ? localAssets : defaultPublicAssets),
        live: false,
        provider: localAssets.length ? "LocalFeeds" : "StaticFallback",
        error: error instanceof Error ? error.message : "Онлайн-провайдер валют недоступен"
      };
    } catch {
      return {
        data: await mergeManagedAssets(defaultPublicAssets),
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
  const [localExchangeBySlug, changers] = await Promise.all([
    loadLocalExchangeBySlug(slug),
    client.getChangers().catch(() => [] as BestChangeChanger[])
  ]);
  const changer = changers.find((item) => String(item.id) === slug)
    ?? (localExchangeBySlug ? changers.find((item) => matchesLocalExchange(item, localExchangeBySlug)) : undefined);
  if (!changer) {
    if (!localExchangeBySlug) return null;

    const [localReviewStats, localReviews, importedProviderReviews, manualRates] = await Promise.all([
      loadLocalReviewStatsByExchangeId(localExchangeBySlug.id),
      loadLocalPublishedReviewsByExchangeId(localExchangeBySlug.id),
      loadImportedProviderReviewsByExchangeId(localExchangeBySlug.id),
      prisma.exchangeRate.findMany({ where: { exchangeId: localExchangeBySlug.id, enabled: true } })
    ]);
    const uniqueCurrenciesCount = new Set(manualRates.flatMap((r) => [r.fromCode, r.toCode])).size;
    const verified = localExchangeBySlug.status === ExchangeStatus.ACTIVE;
    const localReserve = fallbackExchangeReserve(localExchangeBySlug, 0);
    const reserveLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Сумма резервов",
      "Резерв",
      "Reserve"
    ]) ?? formatUsdReserve(localReserve);
    const currencyCountLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Всего валют",
      "Валюты",
      "Currencies"
    ]) ?? "направления из фида";
    const ratesCountLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Курсов обмена",
      "Курсы",
      "Rates"
    ]) ?? "ожидает фида";
    const ageLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Возраст",
      "Возраст обменника",
      "Age"
    ]) ?? "новый профиль";
    const listedLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "На monik exchange",
      "На сайте",
      "Listed"
    ]) ?? new Intl.DateTimeFormat("ru-RU").format(localExchangeBySlug.createdAt);
    const countryLabel = fieldFromAdminDescription(localExchangeBySlug.description, [
      "Страна",
      "Country"
    ]) ?? "данные из админки";

    return {
      slug: localExchangeBySlug.slug,
      name: localExchangeBySlug.name,
      description: localExchangeBySlug.description,
      domain: localExchangeBySlug.domain,
      url: buildAffiliateUrl(`https://${localExchangeBySlug.domain}`, localExchangeBySlug.partnerUrl) ?? `https://${localExchangeBySlug.domain}`,
      rating: localReviewStats.rating,
      reviews: localReviewStats.reviews,
      activeClaims: 0,
      closedClaims: 0,
      reserve: localReserve,
      reserveLabel,
      insuranceDeposit: localExchangeBySlug.insuranceDeposit,
      noAml: localExchangeBySlug.noAml,
      verified,
      status: verified ? "Активен" : "Отключен",
      languages: [],
      facts: [
        { label: "Возраст", value: ageLabel },
        { label: "На monik exchange", value: listedLabel },
        { label: "Страна", value: countryLabel },
        { label: "AML-прозрачность", value: localExchangeBySlug.noAml ? "без AML" : "AML: низкий риск" },
        { label: "Всего валют", value: currencyCountLabel },
        { label: "Курсов обмена", value: ratesCountLabel },
        { label: "Сумма резервов", value: reserveLabel },
        { label: "Домен", value: localExchangeBySlug.domain }
      ],
      localReviews,
      externalReviews: importedProviderReviews
    };
  }

  const localExchange = localExchangeBySlug && matchesLocalExchange(changer, localExchangeBySlug)
    ? localExchangeBySlug
    : await loadLocalExchangeForChanger(changer);

  const providerFacts = await loadProviderProfileFacts(changer);
  await syncProviderReviewsByExchangeId(localExchange?.id, providerFacts?.externalReviews ?? []);
  const [localReviewStats, localReviews, importedProviderReviews] = await Promise.all([
    loadLocalReviewStatsByExchangeId(localExchange?.id),
    loadLocalPublishedReviewsByExchangeId(localExchange?.id),
    loadImportedProviderReviewsByExchangeId(localExchange?.id)
  ]);
  const externalReviews = providerFacts?.externalReviews?.length
    ? providerFacts.externalReviews
    : importedProviderReviews;
  const reserveLabel = providerFacts?.reserveLabel ?? formatUsdReserve(changer.reserve);
  const apiFacts = [
    { label: "Сумма резервов", value: reserveLabel },
    { label: "Языки", value: changer.langs.join(", ") },
    { label: "Статус", value: changer.active ? "Активен" : "Отключен" }
  ];
  const facts = [...(providerFacts?.facts ?? []), ...apiFacts]
    .filter((fact) => fact.value.trim().length > 0)
    .filter((fact, index, list) => list.findIndex((item) => item.label === fact.label) === index);
  const fallbackRating = providerRating(changer);
  const profileReviews = Math.max(
    localReviewStats.reviews,
    localReviews.length,
    externalReviews.length
  );
  const profileRating = localReviewStats.rating ?? fallbackRating;

  return {
    slug: localExchange?.slug ?? String(changer.id),
    name: changer.name,
    description: `${changer.active ? "Активен" : "Отключен"} · резерв ${reserveLabel}`,
    domain: sanitizeDomain(
      providerFacts?.domain ??
      [changer.urls.ru, ...Object.values(changer.urls)].find((u) => u && !isBestchangeUrl(u))
    ),
    url: buildAffiliateUrl(
      [changer.urls.ru, ...Object.values(changer.urls)].find((u) => u && !isBestchangeUrl(u)) ?? null,
      localExchange?.partnerUrl
    ) ?? [changer.urls.ru, ...Object.values(changer.urls)].find((u) => u && !isBestchangeUrl(u)) ?? null,
    rating: profileRating,
    reviews: profileReviews,
    activeClaims: providerFacts?.activeClaims ?? reviewBucket(changer, "claim"),
    closedClaims: providerFacts?.closedClaims ?? reviewBucket(changer, "closed"),
    reserve: changer.reserve,
    reserveLabel,
    insuranceDeposit: localExchange?.insuranceDeposit ?? null,
    noAml: localExchange?.noAml ?? false,
    verified: changer.active,
    status: changer.active ? "Активен" : "Отключен",
    languages: changer.langs,
    facts,
    localReviews,
    externalReviews
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
    insuranceDeposit: liveExchange.insuranceDeposit,
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

const genericCurrencyAliases: Record<string, string[]> = {
  RUB: [
    "CARDRUB",
    "SBERRUB",
    "SBPRUB",
    "TCSBRUB",
    "ACRUB",
    "MIRCRUB",
    "TBRUB",
    "GPBRUB",
    "PSBRUB",
    "RFBRUB",
    "RSHBRUB",
    "ACCRUB",
    "SBERQRUB",
    "TCSBQRUB"
  ]
};

function currencyCandidates(currencies: BestChangeCurrency[], code: string) {
  const exact = findCurrency(currencies, code);
  const aliases = genericCurrencyAliases[code.trim().toUpperCase()] ?? [];
  const aliasCurrencies = aliases
    .map((alias) => findCurrency(currencies, alias))
    .filter((currency): currency is BestChangeCurrency => Boolean(currency));
  const merged = new Map<number, BestChangeCurrency>();

  if (exact) merged.set(exact.id, exact);
  for (const currency of aliasCurrencies) merged.set(currency.id, currency);

  return [...merged.values()];
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
  const fromCandidates = currencyCandidates(currencies, fromCode);
  const toCandidates = currencyCandidates(currencies, toCode);
  if (!fromCandidates.length || !toCandidates.length) throw new BestChangePairError(fromCode, toCode);

  const changers = await client.getChangers();
  const localReviews = await loadLocalReviewMatches(changers);
  const pairOffers = await Promise.all(
    fromCandidates.flatMap((from) =>
      toCandidates
        .map(async (to) => {
          const rates = await client.getRates(from.id, to.id).catch(() => []);
          return normalizeBestChangeOffers({ amount, from, to, changers, rates, localReviews });
        })
    )
  );

  return mergePublicOffers(pairOffers.flat(), []);
}

export async function loadManualExchangeRates({
  fromCode,
  toCode,
  amount
}: {
  fromCode: string;
  toCode: string;
  amount: number;
}): Promise<NormalizedOffer[]> {
  if (!databaseContentEnabled()) return [];

  const rates = await prisma.exchangeRate.findMany({
    where: {
      fromCode,
      toCode,
      enabled: true,
      exchange: {
        status: ExchangeStatus.ACTIVE
      }
    },
    include: {
      exchange: true
    }
  });

  if (!rates.length) return [];

  const exchangeIds = rates.map((r) => r.exchangeId);
  const reviewAggregate = await prisma.review.groupBy({
    by: ["exchangeId"],
    where: {
      status: ModerationStatus.PUBLISHED,
      exchangeId: { in: exchangeIds }
    },
    _avg: { rating: true },
    _count: { rating: true }
  });
  const reviewsByExchangeId = new Map(reviewAggregate.map((item) => [item.exchangeId, item]));

  const from = findCurrency(localCurrencies, fromCode) || { id: 0, code: fromCode, name: fromCode, kind: "FIAT" as const };
  const to = findCurrency(localCurrencies, toCode) || { id: 0, code: toCode, name: toCode, kind: "FIAT" as const };
  const paymentMethods = offerPaymentMethods(from, to);

  return rates.map((rate) => {
    const exchange = rate.exchange;
    const aggregate = reviewsByExchangeId.get(exchange.id);
    const reviews = aggregate?._count.rating ?? 0;
    const rating = aggregate?._avg.rating ?? null;

    return {
      id: "manual-" + rate.id,
      exchange: {
        name: exchange.name,
        slug: exchange.slug,
        isDemo: exchange.isDemo,
        rating,
        reviews,
        verified: exchange.status === ExchangeStatus.ACTIVE,
        url: buildAffiliateUrl(`https://${exchange.domain}`, exchange.partnerUrl) ?? `https://${exchange.domain}`
      },
      from: fromCode,
      to: toCode,
      rate: rate.rate,
      receivedAmount: amount * rate.rate,
      reserve: rate.reserve,
      minAmount: rate.minAmount,
      maxAmount: rate.reserve,
      kyc: exchange.noAml ? "NONE" : "OPTIONAL",
      aml: exchange.noAml ? "NONE" : "STANDARD",
      processing: "AUTOMATIC" as const,
      marks: [] as string[],
      cities: [] as string[],
      paymentMethods,
      updatedAt: rate.updatedAt.toISOString()
    };
  });
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
  const databaseOffersPromise = loadDatabaseFallbackOffers({ fromCode, toCode, amount }).catch(() => []);
  const manualOffersPromise = loadManualExchangeRates({ fromCode, toCode, amount }).catch(() => []);

  if (!hasBestChangeApiConfig()) {
    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);
    const fallbackOffers = mergePublicOffers([...manualOffers, ...databaseOffers], localOffers);
    if (fallbackOffers.length) {
      return {
        data: fallbackOffers,
        live: false,
        provider: databaseOffers.length ? "DatabaseFallback" : "LocalFeeds",
        error: "BESTCHANGE_API_URL is not configured, showing fallback exchange offers"
      };
    }
  }

  try {
    const liveOffers = await withTimeout(
      loadLiveOffers({ fromCode, toCode, amount, client }),
      publicTimeoutMs("RATESCOPE_OFFERS_FAST_TIMEOUT_MS", 8_000),
      "Live rate provider did not respond in time"
    );
    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);
    const fallbackOffers = liveOffers.length < 10
      ? mergePublicOffers(databaseOffers, localOffers)
      : databaseOffers;

    return {
      data: mergePublicOffers([...liveOffers, ...manualOffers], fallbackOffers),
      live: true,
      provider: fallbackOffers.length ? "LiveRateProvider+Fallback" : "LiveRateProvider"
    };
  } catch (error) {
    const [databaseOffers, localOffers, manualOffers] = await Promise.all([databaseOffersPromise, localOffersPromise, manualOffersPromise]);
    const fallbackOffers = mergePublicOffers([...manualOffers, ...databaseOffers], localOffers);
    if (fallbackOffers.length) {
      return {
        data: fallbackOffers,
        live: false,
        provider: databaseOffers.length ? "DatabaseFallback" : "LocalFeeds",
        error: error instanceof Error ? error.message : "Live rate provider is unavailable"
      };
    }

    throw error;
  }
}
