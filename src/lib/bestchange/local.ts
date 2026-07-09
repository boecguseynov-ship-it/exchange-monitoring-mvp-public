import type { BestChangeChanger, BestChangeCurrency, BestChangeRate } from "./schema";
import { normalizeBestChangeAssets, normalizeBestChangeOffers, findCurrency } from "./normalize";

let nextLocalCurrencyId = 1;

function localCurrency(code: string, name: string, kind: BestChangeCurrency["kind"] = "FIAT", network?: string): BestChangeCurrency {
  return {
    id: nextLocalCurrencyId++,
    code,
    name,
    kind,
    ...(network ? { network } : {})
  };
}

export const localCurrencies: BestChangeCurrency[] = [
  localCurrency("BTC", "Bitcoin", "CRYPTO", "BTC"),
  localCurrency("BTCBEP20", "Bitcoin BEP20", "CRYPTO", "BEP20"),
  localCurrency("ETH", "Ethereum", "CRYPTO", "ETH"),
  localCurrency("ETHERC20", "Ethereum ERC20", "CRYPTO", "ERC20"),
  localCurrency("ETHBEP20", "Ethereum BEP20", "CRYPTO", "BEP20"),
  localCurrency("LTC", "Litecoin", "CRYPTO", "LTC"),
  localCurrency("XMR", "Monero", "CRYPTO", "XMR"),
  localCurrency("BCH", "Bitcoin Cash", "CRYPTO", "BCH"),
  localCurrency("ZEC", "Zcash", "CRYPTO", "ZEC"),
  localCurrency("DASH", "Dash", "CRYPTO", "DASH"),
  localCurrency("DOGE", "Dogecoin", "CRYPTO", "DOGE"),
  localCurrency("TRX", "TRON", "CRYPTO", "TRC20"),
  localCurrency("TON", "Toncoin", "CRYPTO", "TON"),
  localCurrency("SOL", "Solana", "CRYPTO", "SOL"),
  localCurrency("XRP", "Ripple", "CRYPTO", "XRP"),
  localCurrency("ETC", "Ethereum Classic", "CRYPTO", "ETC"),
  localCurrency("ADA", "Cardano", "CRYPTO", "ADA"),
  localCurrency("DOT", "Polkadot", "CRYPTO", "DOT"),
  localCurrency("MATIC", "Polygon", "CRYPTO", "POLYGON"),
  localCurrency("AVAX", "Avalanche", "CRYPTO", "AVAXC"),
  localCurrency("DAI", "Dai", "CRYPTO", "ERC20"),
  localCurrency("LINK", "Chainlink", "CRYPTO", "ERC20"),
  localCurrency("UNI", "Uniswap", "CRYPTO", "ERC20"),
  localCurrency("ATOM", "Cosmos", "CRYPTO", "ATOM"),
  localCurrency("NEAR", "NEAR Protocol", "CRYPTO", "NEAR"),
  localCurrency("APT", "Aptos", "CRYPTO", "APT"),
  localCurrency("ARB", "Arbitrum", "CRYPTO", "ARBITRUM"),
  localCurrency("OP", "Optimism", "CRYPTO", "OPTIMISM"),
  localCurrency("BNB", "BNB", "CRYPTO", "BNB"),
  localCurrency("BNBBEP20", "BNB BEP20", "CRYPTO", "BEP20"),
  localCurrency("USDTTRC20", "Tether USD TRC20", "CRYPTO", "TRC20"),
  localCurrency("USDTERC20", "Tether USD ERC20", "CRYPTO", "ERC20"),
  localCurrency("USDTBEP20", "Tether USD BEP20", "CRYPTO", "BEP20"),
  localCurrency("USDTTON", "Tether USD TON", "CRYPTO", "TON"),
  localCurrency("USDTSOL", "Tether USD Solana", "CRYPTO", "SOL"),
  localCurrency("USDTPOLYGON", "Tether USD Polygon", "CRYPTO", "POLYGON"),
  localCurrency("USDTAVAXC", "Tether USD Avalanche C-Chain", "CRYPTO", "AVAXC"),
  localCurrency("USDTNEAR", "Tether USD NEAR", "CRYPTO", "NEAR"),
  localCurrency("USDTOMNI", "Tether USD Omni", "CRYPTO", "OMNI"),
  localCurrency("USDCERC20", "USD Coin ERC20", "CRYPTO", "ERC20"),
  localCurrency("USDCTRC20", "USD Coin TRC20", "CRYPTO", "TRC20"),
  localCurrency("USDCBEP20", "USD Coin BEP20", "CRYPTO", "BEP20"),
  localCurrency("USDCSOL", "USD Coin Solana", "CRYPTO", "SOL"),
  localCurrency("USDCPOLYGON", "USD Coin Polygon", "CRYPTO", "POLYGON"),
  localCurrency("USDCNEAR", "USD Coin NEAR", "CRYPTO", "NEAR"),
  localCurrency("SBERRUB", "Sberbank RUB", "FIAT"),
  localCurrency("SBERQRUB", "Sberbank QR RUB", "FIAT"),
  localCurrency("TCSBRUB", "T-Bank RUB", "FIAT"),
  localCurrency("TCSBQRUB", "T-Bank QR RUB", "FIAT"),
  localCurrency("ACRUB", "Alfa-Bank RUB", "FIAT"),
  localCurrency("TBRUB", "VTB RUB", "FIAT"),
  localCurrency("RFBRUB", "Raiffeisen RUB", "FIAT"),
  localCurrency("RFBUAH", "Raiffeisen UAH", "FIAT"),
  localCurrency("GPBRUB", "Gazprombank RUB", "FIAT"),
  localCurrency("PSBRUB", "Promsvyazbank RUB", "FIAT"),
  localCurrency("RSHBRUB", "Rosselkhozbank RUB", "FIAT"),
  localCurrency("MIRCRUB", "MIR Card RUB", "FIAT"),
  localCurrency("CARDRUB", "Visa/Mastercard RUB", "FIAT"),
  localCurrency("SBPRUB", "SBP RUB", "FIAT"),
  localCurrency("ACCRUB", "Bank Account RUB", "FIAT"),
  localCurrency("TCSBCRUB", "T-Bank cash-in RUB", "FIAT"),
  localCurrency("CASHAED", "Cash AED", "CASH"),
  localCurrency("CASHAMD", "Cash AMD", "CASH"),
  localCurrency("CASHARS", "Cash ARS", "CASH"),
  localCurrency("CASHAUD", "Cash AUD", "CASH"),
  localCurrency("CASHAZN", "Cash AZN", "CASH"),
  localCurrency("CASHBGN", "Cash BGN", "CASH"),
  localCurrency("CASHBRL", "Cash BRL", "CASH"),
  localCurrency("CASHBYN", "Cash BYN", "CASH"),
  localCurrency("CASHCAD", "Cash CAD", "CASH"),
  localCurrency("CASHCHF", "Cash CHF", "CASH"),
  localCurrency("CASHCNY", "Cash CNY", "CASH"),
  localCurrency("CASHCOP", "Cash COP", "CASH"),
  localCurrency("CASHCZK", "Cash CZK", "CASH"),
  localCurrency("CASHEGP", "Cash EGP", "CASH"),
  localCurrency("CASHEUR", "Cash EUR", "CASH"),
  localCurrency("CASHGBP", "Cash GBP", "CASH"),
  localCurrency("CASHGEL", "Cash GEL", "CASH"),
  localCurrency("CASHIDR", "Cash IDR", "CASH"),
  localCurrency("CASHILS", "Cash ILS", "CASH"),
  localCurrency("CASHINR", "Cash INR", "CASH"),
  localCurrency("CASHJPY", "Cash JPY", "CASH"),
  localCurrency("CASHKGS", "Cash KGS", "CASH"),
  localCurrency("CASHKRW", "Cash KRW", "CASH"),
  localCurrency("CASHKZT", "Cash KZT", "CASH"),
  localCurrency("CASHMDL", "Cash MDL", "CASH"),
  localCurrency("CASHMXN", "Cash MXN", "CASH"),
  localCurrency("CASHNGN", "Cash NGN", "CASH"),
  localCurrency("CASHPLN", "Cash PLN", "CASH"),
  localCurrency("CASHRON", "Cash RON", "CASH"),
  localCurrency("CASHRUB", "Cash RUB", "CASH"),
  localCurrency("CASHSAR", "Cash SAR", "CASH"),
  localCurrency("CASHSGD", "Cash SGD", "CASH"),
  localCurrency("CASHTHB", "Cash THB", "CASH"),
  localCurrency("CASHTRY", "Cash TRY", "CASH"),
  localCurrency("CASHUAH", "Cash UAH", "CASH"),
  localCurrency("CASHUSD", "Cash USD", "CASH"),
  localCurrency("CASHVND", "Cash VND", "CASH"),
  localCurrency("PPAUD", "PayPal AUD", "FIAT"),
  localCurrency("PPCAD", "PayPal CAD", "FIAT"),
  localCurrency("PPEUR", "PayPal EUR", "FIAT"),
  localCurrency("PPGBP", "PayPal GBP", "FIAT"),
  localCurrency("PPUSD", "PayPal USD", "FIAT"),
  localCurrency("PNREUR", "Payoneer EUR", "FIAT"),
  localCurrency("PNRUSD", "Payoneer USD", "FIAT"),
  localCurrency("QWKZT", "QIWI KZT", "FIAT"),
  localCurrency("PMUSD", "Perfect Money USD", "FIAT"),
  localCurrency("PMEUR", "Perfect Money EUR", "FIAT"),
  localCurrency("ADVCUSD", "Volet USD", "FIAT"),
  localCurrency("ADVCEUR", "Volet EUR", "FIAT"),
  localCurrency("PAYEERUSD", "Payeer USD", "FIAT"),
  localCurrency("PAYEERRUB", "Payeer RUB", "FIAT"),
  localCurrency("SKLUSD", "Skrill USD", "FIAT"),
  localCurrency("SKLEUR", "Skrill EUR", "FIAT"),
  localCurrency("NTLRUSD", "Neteller USD", "FIAT"),
  localCurrency("NTLREUR", "Neteller EUR", "FIAT"),
  localCurrency("YAMRUB", "YooMoney RUB", "FIAT"),
  localCurrency("BINANCEUSDT", "Binance balance USDT", "FIAT"),
  localCurrency("BYBITUSDT", "Bybit balance USDT", "FIAT"),
  localCurrency("OKXUSDT", "OKX balance USDT", "FIAT"),
  localCurrency("HTXUSDT", "HTX balance USDT", "FIAT"),
  localCurrency("KRAKENUSD", "Kraken balance USD", "FIAT"),
  localCurrency("COINBASEUSD", "Coinbase balance USD", "FIAT"),
  localCurrency("RUB", "Russian Ruble", "FIAT"),
  localCurrency("USD", "US Dollar", "FIAT"),
  localCurrency("EUR", "Euro", "FIAT"),
  localCurrency("UAH", "Ukrainian Hryvnia", "FIAT"),
  localCurrency("KZT", "Kazakhstani Tenge", "FIAT"),
  localCurrency("TRY", "Turkish Lira", "FIAT"),
  localCurrency("CNY", "Chinese Yuan", "FIAT"),
  localCurrency("GBP", "British Pound", "FIAT"),
  localCurrency("AED", "UAE Dirham", "FIAT"),
  localCurrency("AMD", "Armenian Dram", "FIAT"),
  localCurrency("AUD", "Australian Dollar", "FIAT"),
  localCurrency("AZN", "Azerbaijani Manat", "FIAT"),
  localCurrency("BYN", "Belarusian Ruble", "FIAT"),
  localCurrency("CAD", "Canadian Dollar", "FIAT"),
  localCurrency("CHF", "Swiss Franc", "FIAT"),
  localCurrency("CZK", "Czech Koruna", "FIAT"),
  localCurrency("GEL", "Georgian Lari", "FIAT"),
  localCurrency("JPY", "Japanese Yen", "FIAT"),
  localCurrency("KGS", "Kyrgyzstani Som", "FIAT"),
  localCurrency("PLN", "Polish Zloty", "FIAT")
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

export function localPairRate(from: BestChangeCurrency, to: BestChangeCurrency) {
  if (from.code === "RUB" && to.code.includes("USD")) return 1 / 90;
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
  if (!from || !to) return [];

  const multiplier = localPairRate(from, to);
  const sameAssetPair = from.id === to.id;
  const rates = baseRates.map((rate, index) => ({
    ...rate,
    fromId: from.id,
    toId: to.id,
    out: sameAssetPair ? 0.998 - index * 0.0015 : rate.out * multiplier * (1 - index * 0.002),
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
