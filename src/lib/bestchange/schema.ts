export type BestChangeLocaleMap = Record<string, string>;

export type BestChangeCurrency = {
  id: number;
  code: string;
  name: string;
  kind?: "FIAT" | "CRYPTO" | string;
  network?: string | null;
};

export type BestChangeChanger = {
  id: number;
  name: string;
  urls: BestChangeLocaleMap;
  pages: BestChangeLocaleMap;
  reserve: number;
  active: boolean;
  langs: string[];
  reviews?: Record<string, number | string | null | undefined>;
};

export type BestChangeRate = {
  changerId: number;
  fromId: number;
  toId: number;
  in: number;
  out: number;
  minAmount: number;
  maxAmount: number;
  reserve?: number;
  marks?: string[];
  kyc?: "NONE" | "OPTIONAL" | "REQUIRED" | string;
  processing?: "AUTOMATIC" | "SEMI_AUTOMATIC" | "MANUAL" | string;
  updatedAt?: string;
};

export function numberOr(value: unknown, fallback: number) {
  const number = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function stringOr(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
