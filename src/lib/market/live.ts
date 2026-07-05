type LiveTicker = {
  code: string;
  name: string;
  usd: number;
  change24h: number;
};

const coinIds = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  TON: "the-open-network"
} as const;

const fallback: LiveTicker[] = [
  { code: "BTC", name: "Bitcoin", usd: 0, change24h: 0 },
  { code: "ETH", name: "Ethereum", usd: 0, change24h: 0 },
  { code: "BNB", name: "BNB", usd: 0, change24h: 0 },
  { code: "SOL", name: "Solana", usd: 0, change24h: 0 },
  { code: "TON", name: "Toncoin", usd: 0, change24h: 0 }
];

type LiveMarket = {
  tickers: LiveTicker[];
  live: boolean;
  updatedAt: string;
};

export function createLiveTickerService({
  fetcher = fetch,
  now = () => Date.now()
}: {
  fetcher?: typeof fetch;
  now?: () => number;
} = {}) {
  const cache = createAsyncCache({ now, maxEntries: 2 });

  async function load(): Promise<LiveMarket> {
    const response = await fetcher(
      `${process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3"}/simple/price?ids=${Object.values(coinIds).join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(4_500), next: { revalidate: 60 } }
    );
    if (!response.ok) {
      throw new Error(`Market provider returned ${response.status}`);
    }
    const data = (await response.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;
    return {
      live: true,
      updatedAt: new Date(now()).toISOString(),
      tickers: Object.entries(coinIds).map(([code, id]) => ({
        code,
        name: fallback.find((item) => item.code === code)?.name ?? code,
        usd: data[id]?.usd ?? 0,
        change24h: data[id]?.usd_24h_change ?? 0
      }))
    };
  }

  async function getLiveTickers(): Promise<LiveMarket> {
    return cache
      .get("usd-tickers", load, { ttlMs: 60_000, staleMs: 10 * 60_000 })
      .catch(() => ({
        tickers: fallback,
        live: false,
        updatedAt: new Date(now()).toISOString()
      }));
  }

  return { getLiveTickers };
}

const sharedLiveTickerService = createLiveTickerService();

export const getLiveTickers = sharedLiveTickerService.getLiveTickers;
import { createAsyncCache } from "@/lib/cache/async-cache";
