import type { BestChangeChanger, BestChangeCurrency, BestChangeRate } from "./schema";
import { normalizeBestChangeAssets, normalizeBestChangeOffers, findCurrency } from "./normalize";

export const localCurrencies: BestChangeCurrency[] = [
  { id: 1, code: "RUB", name: "Russian Ruble", kind: "FIAT" },
  { id: 2, code: "USDTTRC20", name: "Tether USD TRC20", kind: "CRYPTO", network: "TRC20" },
  { id: 3, code: "USDTERC20", name: "Tether USD ERC20", kind: "CRYPTO", network: "ERC20" },
  { id: 4, code: "USDCERC20", name: "USD Coin ERC20", kind: "CRYPTO", network: "ERC20" },
  { id: 5, code: "BTC", name: "Bitcoin", kind: "CRYPTO", network: "BTC" },
  { id: 6, code: "ETHERC20", name: "Ethereum ERC20", kind: "CRYPTO", network: "ERC20" }
];

export const localChangers: BestChangeChanger[] = [
  {
    id: 101,
    name: "OrangeSwap",
    urls: { ru: "https://example.com/orange-swap" },
    pages: { ru: "https://www.bestchange.pro/orange-swap.html" },
    reserve: 850000,
    active: true,
    langs: ["ru", "en"],
    reviews: { positive: 128, neutral: 4, negative: 1, claim: 0, closed: 8 }
  },
  {
    id: 102,
    name: "DarkRate",
    urls: { ru: "https://example.com/dark-rate" },
    pages: { ru: "https://www.bestchange.pro/dark-rate.html" },
    reserve: 620000,
    active: true,
    langs: ["ru"],
    reviews: { positive: 92, neutral: 6, negative: 2, claim: 1, closed: 5 }
  },
  {
    id: 103,
    name: "ScopeX",
    urls: { ru: "https://example.com/scopex" },
    pages: { ru: "https://www.bestchange.pro/scopex.html" },
    reserve: 1240000,
    active: true,
    langs: ["ru", "en"],
    reviews: { positive: 211, neutral: 8, negative: 3, claim: 0, closed: 12 }
  }
];

const baseRates: Omit<BestChangeRate, "fromId" | "toId">[] = [
  { changerId: 101, in: 1, out: 0.01095, minAmount: 1, maxAmount: 900000, reserve: 540000, marks: [], kyc: "NONE", processing: "AUTOMATIC" },
  { changerId: 102, in: 1, out: 0.01083, minAmount: 1, maxAmount: 600000, reserve: 390000, marks: ["percent"], kyc: "OPTIONAL", processing: "SEMI_AUTOMATIC" },
  { changerId: 103, in: 1, out: 0.01102, minAmount: 1, maxAmount: 1200000, reserve: 730000, marks: [], kyc: "NONE", processing: "AUTOMATIC" }
];

function pairRate(from: BestChangeCurrency, to: BestChangeCurrency) {
  if (from.code === "RUB" && to.code.includes("USD")) return 1;
  if (from.code.includes("USD") && to.code === "RUB") return 92;
  if (from.code === "BTC" && to.code.includes("USD")) return 61500;
  if (from.code.includes("USD") && to.code === "BTC") return 1 / 63000;
  if (from.code.includes("ETH") && to.code.includes("USD")) return 3300;
  if (from.code.includes("USD") && to.code.includes("ETH")) return 1 / 3400;
  return 1;
}

export async function loadLocalAssets() {
  return normalizeBestChangeAssets(localCurrencies);
}

export async function loadLocalOffers({
  fromCode,
  toCode,
  amount
}: {
  fromCode: string;
  toCode: string;
  amount: number;
}) {
  const from = findCurrency(localCurrencies, fromCode);
  const to = findCurrency(localCurrencies, toCode);
  if (!from || !to || from.id === to.id) return [];

  const multiplier = pairRate(from, to);
  const rates = baseRates.map((rate, index) => ({
    ...rate,
    fromId: from.id,
    toId: to.id,
    out: rate.out * multiplier * (1 - index * 0.002),
    updatedAt: new Date().toISOString()
  }));

  return normalizeBestChangeOffers({
    amount,
    from,
    to,
    changers: localChangers,
    rates,
    localReviews: new Map()
  });
}
