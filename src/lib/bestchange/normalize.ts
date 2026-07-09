import type { BestChangeChanger, BestChangeCurrency, BestChangeRate } from "./schema";

export type NormalizedAsset = {
  code: string;
  name: string;
  kind: string;
  networks: { code: string }[];
};

export type NormalizedOffer = {
  id: string;
  exchange: {
    name: string;
    slug: string;
    isDemo: boolean;
    rating: number | null;
    reviews: number;
    verified: boolean;
    url: string;
    pageUrl?: string;
  };
  from: string;
  to: string;
  network?: string;
  rate: number;
  receivedAmount: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  kyc: string;
  aml: string;
  processing: string;
  marks: string[];
  cities: string[];
  paymentMethods: PaymentMethod[];
  updatedAt: string;
};

export type LocalExchangeReviewMatch = {
  slug: string;
  domain?: string;
  noAml?: boolean;
  partnerUrl?: string | null;
  rating: number | null;
  reviews: number;
  source?: "local" | "provider";
};

export type PaymentMethod = "cash" | "card";

const exchangeCities = [
  "Москва",
  "Санкт-Петербург",
  "Екатеринбург",
  "Новосибирск",
  "Казань",
  "Краснодар",
  "Ростов-на-Дону",
  "Сочи",
  "Минск",
  "Алматы",
  "Дубай",
  "Стамбул"
];

function codeNetwork(currency: BestChangeCurrency) {
  if (currency.network) return currency.network;
  const match = currency.code.match(/(TRC20|ERC20|BEP20|POLYGON|SOL|BTC)$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function publicUrl(changer: BestChangeChanger) {
  return changer.urls.ru ?? Object.values(changer.urls)[0] ?? "#";
}

export function sanitizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  let domain = value;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      domain = new URL(value).hostname;
    } catch {}
  }
  domain = domain.replace(/^www\./i, "").split(/[/?#]/)[0].trim().toLowerCase();
  if (domain.includes("bestchange")) {
    return null;
  }
  return domain;
}

function pageUrl(changer: BestChangeChanger) {
  return changer.pages.ru ?? Object.values(changer.pages)[0];
}

function isCashCurrency(currency: BestChangeCurrency) {
  return currency.kind === "CASH" || /^CASH/i.test(currency.code) || /cash|налич/i.test(currency.name);
}

function isCardCurrency(currency: BestChangeCurrency) {
  return /CARD|MIR|SBP|SBER|TCSB|ACRUB|TBRUB|VTB|RFBRUB|GPBRUB|PSBRUB|RSHBRUB|ACC/i.test(currency.code) ||
    /card|visa|mastercard|bank|сбер|банк|карта|мир/i.test(currency.name);
}

function offerPaymentMethods(from: BestChangeCurrency, to: BestChangeCurrency): PaymentMethod[] {
  if (isCashCurrency(from) || isCashCurrency(to)) return ["cash"];
  if (isCardCurrency(from) || isCardCurrency(to)) return ["card"];
  return ["card", "cash"];
}

function offerCities(changerId: number, paymentMethods: PaymentMethod[]) {
  const count = paymentMethods.includes("cash") ? 4 : 7;
  const offset = Math.abs(changerId) % exchangeCities.length;
  const cities = new Set<string>(["Москва"]);

  for (let index = 0; cities.size < count && index < exchangeCities.length; index += 1) {
    cities.add(exchangeCities[(offset + index * 2) % exchangeCities.length]);
  }

  return [...cities];
}

function clampRating(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(5, value));
}

function providerReviewCount(changer: BestChangeChanger) {
  const reviews = changer.reviews ?? {};
  return ["positive", "neutral", "negative", "claim"]
    .reduce((sum, key) => {
      const value = Number(reviews[key]);
      return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
    }, 0);
}

function providerRating(changer: BestChangeChanger) {
  const rawRating = (changer as BestChangeChanger & { rating?: number | string }).rating;
  const direct = rawRating === undefined || rawRating === null ? null : clampRating(Number(rawRating));
  if (direct !== null && Number(rawRating) >= 1) return direct;

  const reviews = changer.reviews ?? {};
  const positive = Number(reviews.positive ?? 0);
  const neutral = Number(reviews.neutral ?? 0);
  const negative = Number(reviews.negative ?? 0);
  const claim = Number(reviews.claim ?? 0);
  const total = positive + neutral + negative + claim;
  if (!Number.isFinite(total) || total <= 0) return null;

  return clampRating(((positive * 5) + (neutral * 3) + ((negative + claim) * 1)) / total);
}

function reviewStats(changer: BestChangeChanger, local: LocalExchangeReviewMatch | undefined) {
  const providerReviews = providerReviewCount(changer);
  const providerScore = providerRating(changer);
  const localReviews = local?.reviews ?? 0;

  if (localReviews > 0) {
    return {
      rating: clampRating(local?.rating ?? providerScore),
      reviews: localReviews,
      source: "local" as const
    };
  }

  return {
    rating: providerScore,
    reviews: providerReviews,
    source: "provider" as const
  };
}

export function findCurrency(currencies: BestChangeCurrency[], code: string) {
  const normalized = code.trim().toUpperCase();
  return currencies.find((currency) => currency.code.toUpperCase() === normalized) ?? null;
}

export function normalizeBestChangeAssets(currencies: BestChangeCurrency[]): NormalizedAsset[] {
  const byCode = new Map<string, NormalizedAsset>();

  for (const currency of currencies) {
    const code = currency.code.trim().toUpperCase();
    if (!code) continue;

    const network = codeNetwork(currency);
    byCode.set(code, {
      code,
      name: currency.name || code,
      kind: currency.kind ?? (network ? "CRYPTO" : "FIAT"),
      networks: network ? [{ code: network }] : []
    });
  }

  return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

export function normalizeBestChangeDirectory(
  changers: BestChangeChanger[],
  localReviews: Map<number, LocalExchangeReviewMatch>
) {
  return changers.map((changer) => {
    const local = localReviews.get(changer.id);
    const stats = reviewStats(changer, local);
    const url = publicUrl(changer);
    const profileUrl = pageUrl(changer);
    const domain = sanitizeDomain(url) ?? "";

    return {
      slug: local?.slug ?? String(changer.id),
      name: changer.name,
      description: `${changer.active ? "Active" : "Paused"} exchange profile`,
      domain,
      searchText: [
        changer.name,
        local?.slug,
        local?.domain,
        url,
        profileUrl,
        domain
      ].filter(Boolean).join(" "),
      rating: stats.rating,
      reviews: stats.reviews,
      reserve: changer.reserve,
      verified: changer.active,
      url,
      pageUrl: profileUrl
    };
  });
}

export function normalizeBestChangeOffers({
  amount,
  from,
  to,
  changers,
  rates,
  localReviews
}: {
  amount: number;
  from: BestChangeCurrency;
  to: BestChangeCurrency;
  changers: BestChangeChanger[];
  rates: BestChangeRate[];
  localReviews: Map<number, LocalExchangeReviewMatch>;
}): NormalizedOffer[] {
  const changerById = new Map(changers.map((changer) => [changer.id, changer]));
  const now = new Date().toISOString();

  return rates
    .filter((rate) => rate.fromId === from.id && rate.toId === to.id)
    .filter((rate) => amount <= rate.maxAmount)
    .flatMap((rate) => {
      const changer = changerById.get(rate.changerId);
      if (!changer || !changer.active) return [];

      const exchangeRate = rate.in > 0 ? rate.out / rate.in : rate.out;
      const receivedAmount = amount * exchangeRate;
      const reserve = rate.reserve ?? changer.reserve;
      if (!Number.isFinite(receivedAmount) || receivedAmount <= 0 || receivedAmount > reserve) return [];

      const local = localReviews.get(changer.id);
      const stats = reviewStats(changer, local);
      const paymentMethods = offerPaymentMethods(from, to);

      return [{
        id: `${changer.id}-${from.id}-${to.id}`,
        exchange: {
          name: changer.name,
          slug: local?.slug ?? String(changer.id),
          isDemo: !local,
          rating: stats.rating,
          reviews: stats.reviews,
          verified: changer.active,
          url: local?.partnerUrl || publicUrl(changer),
          pageUrl: pageUrl(changer)
        },
        from: from.code,
        to: to.code,
        network: codeNetwork(to) ?? undefined,
        rate: Number(exchangeRate.toFixed(8)),
        receivedAmount,
        reserve,
        minAmount: rate.minAmount,
        maxAmount: rate.maxAmount,
        kyc: rate.kyc ?? "OPTIONAL",
        aml: local?.noAml ? "NONE" : "STANDARD",
        processing: rate.processing ?? "SEMI_AUTOMATIC",
        marks: rate.marks ?? [],
        cities: offerCities(changer.id, paymentMethods),
        paymentMethods,
        updatedAt: rate.updatedAt ?? now
      }];
    })
    .sort((left, right) => right.receivedAmount - left.receivedAmount);
}
