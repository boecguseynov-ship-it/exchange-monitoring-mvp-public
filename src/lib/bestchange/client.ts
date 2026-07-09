import { localChangers, localCurrencies } from "./local";
import type { BestChangeChanger, BestChangeCurrency, BestChangeRate } from "./schema";

type ApiCurrency = {
  id: unknown;
  code?: string;
  viewname?: string;
  name?: string;
  crypto?: boolean;
  cash?: boolean;
};

type ApiRate = {
  changer: unknown;
  rate?: unknown;
  inmin?: unknown;
  inmax?: unknown;
  reserve?: unknown;
  marks?: unknown;
};

function endpoint(path: string) {
  const base = process.env.BESTCHANGE_API_URL?.trim() || process.env.RATESCOPE_BESTCHANGE_API_URL?.trim();
  const apiKey = process.env.BESTCHANGE_API_KEY?.trim();
  if (!base || !apiKey) return null;
  return new URL(`v2/${apiKey}/${path}`, base.endsWith("/") ? base : `${base}/`).toString();
}

export function hasBestChangeApiConfig() {
  return Boolean(
    (process.env.BESTCHANGE_API_URL?.trim() || process.env.RATESCOPE_BESTCHANGE_API_URL?.trim()) &&
    process.env.BESTCHANGE_API_KEY?.trim()
  );
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const url = endpoint(path);
  if (!url) return null;

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) throw new Error(`BestChange API responded with ${response.status}`);
  return response.json() as Promise<T>;
}

export function getBestChangeClient() {
  return {
    async getCurrencies(): Promise<BestChangeCurrency[]> {
      const response = await fetchJson<{ currencies?: ApiCurrency[] }>("currencies/ru");
      if (!response || !Array.isArray(response.currencies)) return localCurrencies;

      return response.currencies.map((item) => ({
        id: Number(item.id),
        code: item.code || item.viewname || String(item.id),
        name: item.name || item.viewname || "",
        kind: item.crypto ? "CRYPTO" : (item.cash ? "CASH" : "FIAT")
      }));
    },

    async getChangers(): Promise<BestChangeChanger[]> {
      const response = await fetchJson<{ changers?: BestChangeChanger[] }>("changers/ru");
      if (!response || !Array.isArray(response.changers)) return localChangers;
      return response.changers;
    },

    async getRates(fromId: number, toId: number): Promise<BestChangeRate[]> {
      const response = await fetchJson<{ rates?: Record<string, ApiRate[]> }>(`rates/${fromId}-${toId}`);
      const key = `${fromId}-${toId}`;
      const remote = response?.rates?.[key];

      if (Array.isArray(remote)) {
        return remote.map((item) => ({
          changerId: Number(item.changer),
          fromId,
          toId,
          in: Number(item.rate ?? 1),
          out: 1,
          minAmount: Number(item.inmin ?? 0),
          maxAmount: Number(item.inmax ?? Number.MAX_SAFE_INTEGER),
          reserve: item.reserve === undefined ? undefined : Number(item.reserve),
          marks: Array.isArray(item.marks) ? item.marks.map(String) : [],
          kyc: Array.isArray(item.marks) && (item.marks.includes("cardverify") || item.marks.includes("verifying")) ? "REQUIRED" : "NONE",
          processing: Array.isArray(item.marks) && item.marks.includes("manual") ? "MANUAL" : "AUTOMATIC",
          updatedAt: new Date().toISOString()
        }));
      }

      const { loadLocalOffers } = await import("./local");
      const from = localCurrencies.find((currency) => currency.id === fromId);
      const to = localCurrencies.find((currency) => currency.id === toId);
      if (!from || !to) return [];

      const offers = await loadLocalOffers({ fromCode: from.code, toCode: to.code, amount: 1000 });
      return offers.map((offer) => ({
        changerId: Number(offer.exchange.slug),
        fromId,
        toId,
        in: 1,
        out: offer.rate,
        minAmount: offer.minAmount,
        maxAmount: offer.maxAmount,
        reserve: offer.reserve,
        marks: offer.marks,
        kyc: offer.kyc,
        processing: offer.processing,
        updatedAt: offer.updatedAt
      }));
    }
  };
}
