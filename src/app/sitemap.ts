import type { MetadataRoute } from "next";

const siteUrl = "https://monik.exchange";

const staticPaths = [
  "",
  "/exchangers",
  "/blog",
  "/wiki",
  "/contacts",
  "/api-docs",
  "/privacy",
  "/terms",
  "/bitcoin-to-sberbank",
  "/usdt-trc20-to-sberbank",
  "/exchange/BTC/SBERRUB",
  "/ru/exchange/BTC/SBERRUB"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return staticPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7
  }));
}
