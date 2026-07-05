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
  processing: string;
  marks: string[];
  updatedAt: string;
};

export type LocalExchangeReviewMatch = {
  slug: string;
  rating: number | null;
  reviews: number;
};

function codeNetwork(currency: BestChangeCurrency) {
  if (currency.network) return currency.network;
  const match = currency.code.match(/(TRC20|ERC20|BEP20|POLYGON|SOL|BTC)$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function publicUrl(changer: BestChangeChanger) {
  return changer.urls.ru ?? Object.values(changer.urls)[0] ?? "#";
}

function pageUrl(changer: BestChangeChanger) {
  return changer.pages.ru ?? Object.values(changer.pages)[0];
}

function reviewCount(changer: BestChangeChanger) {
  return Object.values(changer.reviews ?? {}).reduce<number>((sum, value) => {
    const number = Number(value);
    return Number.isFinite(number) ? sum + number : sum;
  }, 0);
}

function clampRating(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(5, value));
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
    const reviews = local?.reviews ?? reviewCount(changer);
    const rating = clampRating(local?.rating ?? (reviews ? 4.2 + Math.min(0.7, reviews / 500) : null));

    return {
      slug: local?.slug ?? String(changer.id),
      name: changer.name,
      description: `${changer.active ? "Active" : "Paused"} exchange profile`,
      domain: publicUrl(changer).replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0],
      rating,
      reviews,
      reserve: changer.reserve,
      verified: changer.active,
      url: publicUrl(changer),
      pageUrl: pageUrl(changer)
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
    .filter((rate) => amount >= rate.minAmount && amount <= rate.maxAmount)
    .flatMap((rate) => {
      const changer = changerById.get(rate.changerId);
      if (!changer || !changer.active) return [];

      const exchangeRate = rate.in > 0 ? rate.out / rate.in : rate.out;
      const receivedAmount = amount * exchangeRate;
      const reserve = rate.reserve ?? changer.reserve;
      if (!Number.isFinite(receivedAmount) || receivedAmount <= 0 || receivedAmount > reserve) return [];

      const local = localReviews.get(changer.id);
      const reviews = local?.reviews ?? reviewCount(changer);
      const rating = clampRating(local?.rating ?? (reviews ? 4.1 + Math.min(0.8, reviews / 600) : null));

      return [{
        id: `${changer.id}-${from.id}-${to.id}`,
        exchange: {
          name: changer.name,
          slug: local?.slug ?? String(changer.id),
          isDemo: !local,
          rating,
          reviews,
          url: publicUrl(changer),
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
        processing: rate.processing ?? "SEMI_AUTOMATIC",
        marks: rate.marks ?? [],
        updatedAt: rate.updatedAt ?? now
      }];
    })
    .sort((left, right) => right.receivedAmount - left.receivedAmount);
}
