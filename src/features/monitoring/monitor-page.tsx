import { notFound } from "next/navigation";
import { AdBanner } from "@/components/ad-banner";
import { AppShell } from "@/components/app-shell";
import { loadPublicAssets } from "@/lib/bestchange/service";
import { getLiveTickers } from "@/lib/market/live";
import { loadHomepageReviews } from "@/lib/public-data";
import { parseDirectionSlug } from "@/lib/direction-routes";
import { loadDirectionSeoText } from "@/lib/direction-seo";
import { MonitorClient } from "./monitor-client";

function defaultInitialPair(assets: Awaited<ReturnType<typeof loadPublicAssets>>["data"]) {
  const available = new Set(assets.map((asset) => asset.code));
  const initialFrom = available.has("RUB") && available.has("USDTTRC20")
    ? "RUB"
    : available.has("USDTTRC20")
      ? "USDTTRC20"
      : assets[0]?.code ?? "USDTTRC20";
  const initialTo = initialFrom === "RUB" && available.has("USDTTRC20")
    ? "USDTTRC20"
    : available.has("USDCERC20")
      ? "USDCERC20"
      : assets.find((asset) => asset.code !== initialFrom)?.code ?? "USDCERC20";

  return { initialFrom, initialTo };
}

function getInitialPair({
  assets,
  direction,
  strictDirection
}: {
  assets: Awaited<ReturnType<typeof loadPublicAssets>>["data"];
  direction?: string;
  strictDirection?: boolean;
}) {
  if (direction) {
    const pair = parseDirectionSlug(direction, assets);
    if (pair) return { initialFrom: pair.from, initialTo: pair.to };
    if (strictDirection) notFound();
  }

  return defaultInitialPair(assets);
}

function getInitialAmount(fromCode: string) {
  if (fromCode === "RUB") return 100000;
  if (["USD", "EUR", "USDTTRC20", "USDTERC20", "USDCERC20"].includes(fromCode)) return 1000;
  if (["BTC", "WBTC", "BTCBEP20"].includes(fromCode)) return 1;
  if (["DOGE", "TRX", "XRP"].includes(fromCode)) return 1000;
  return 10;
}

export async function MonitoringPage({
  direction,
  strictDirection = false
}: {
  direction?: string;
  strictDirection?: boolean;
}) {
  const marketPromise = getLiveTickers();
  const reviewsPromise = loadHomepageReviews();
  const directionSeoPromise = loadDirectionSeoText(direction);
  const publicAssets = await loadPublicAssets();
  const assets = publicAssets.data;
  const providerError = publicAssets.live ? undefined : publicAssets.error;

  const [market, reviewData, directionSeo] = await Promise.all([
    marketPromise,
    reviewsPromise,
    directionSeoPromise
  ]);
  const { latestReviews, reviewAggregate, degraded } = reviewData;
  const { initialFrom, initialTo } = getInitialPair({ assets, direction, strictDirection });

  return (
    <AppShell sidebar={<div />} footer siteBanner={false}>
      <AdBanner placement="monitor-top" />
      <MonitorClient
        assets={assets}
        initialOffers={[]}
        initialTickers={market.tickers}
        marketLive={market.live}
        initialFrom={initialFrom}
        initialTo={initialTo}
        initialAmount={getInitialAmount(initialFrom)}
        providerError={providerError}
        latestReviews={latestReviews.map((review) => ({
          ...review,
          createdAt: review.createdAt.toISOString(),
          user: { name: review.user?.name ?? review.authorName ?? "Пользователь monik exchange" }
        }))}
        reviewAverage={reviewAggregate._avg.rating}
        reviewCount={reviewAggregate._count.rating}
        reviewsDegraded={degraded}
        showDirectionSeo={Boolean(direction)}
        directionSeo={directionSeo}
        syncDirectionUrl={Boolean(direction)}
      />
    </AppShell>
  );
}
