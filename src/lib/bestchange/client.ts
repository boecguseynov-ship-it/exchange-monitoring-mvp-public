import { localChangers, localCurrencies } from "./local";
import type { BestChangeChanger, BestChangeCurrency, BestChangeRate } from "./schema";

type JsonRecord = Record<string, unknown>;

function endpoint(path: string) {
  const base = process.env.BESTCHANGE_API_URL ?? process.env.RATESCOPE_BESTCHANGE_API_URL;
  if (!base) return null;
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const url = endpoint(path);
  if (!url) return null;

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(process.env.BESTCHANGE_API_KEY ? { authorization: `Bearer ${process.env.BESTCHANGE_API_KEY}` } : {})
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) throw new Error(`BestChange API responded with ${response.status}`);
  return response.json() as Promise<T>;
}

function unwrapList<T>(payload: T[] | { data?: T[]; items?: T[] } | null) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload;
  return payload.data ?? payload.items ?? null;
}

function normalizeRemoteRate(item: JsonRecord, fromId: number, toId: number): BestChangeRate {
  return {
    changerId: Number(item.changerId ?? item.changer_id ?? item.exchangeId ?? item.id),
    fromId: Number(item.fromId ?? item.from_id ?? fromId),
    toId: Number(item.toId ?? item.to_id ?? toId),
    in: Number(item.in ?? item.give ?? item.fromAmount ?? 1),
    out: Number(item.out ?? item.receive ?? item.toAmount ?? item.rate ?? 1),
    minAmount: Number(item.minAmount ?? item.min ?? 0),
    maxAmount: Number(item.maxAmount ?? item.max ?? Number.MAX_SAFE_INTEGER),
    reserve: item.reserve === undefined ? undefined : Number(item.reserve),
    marks: Array.isArray(item.marks) ? item.marks.map(String) : [],
    kyc: typeof item.kyc === "string" ? item.kyc : "OPTIONAL",
    processing: typeof item.processing === "string" ? item.processing : "SEMI_AUTOMATIC",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined
  };
}

export function getBestChangeClient() {
  return {
    async getCurrencies(): Promise<BestChangeCurrency[]> {
      return unwrapList(await fetchJson<BestChangeCurrency[] | { data?: BestChangeCurrency[]; items?: BestChangeCurrency[] }>("currencies"))
        ?? localCurrencies;
    },

    async getChangers(): Promise<BestChangeChanger[]> {
      return unwrapList(await fetchJson<BestChangeChanger[] | { data?: BestChangeChanger[]; items?: BestChangeChanger[] }>("changers"))
        ?? localChangers;
    },

    async getRates(fromId: number, toId: number): Promise<BestChangeRate[]> {
      const remote = unwrapList(await fetchJson<JsonRecord[] | { data?: JsonRecord[]; items?: JsonRecord[] }>(`rates?from=${fromId}&to=${toId}`));
      if (remote) return remote.map((item) => normalizeRemoteRate(item, fromId, toId));

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
