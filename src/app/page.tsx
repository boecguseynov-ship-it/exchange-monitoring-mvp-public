import { AppShell } from "@/components/app-shell";
import { MonitorClient } from "@/features/monitoring/monitor-client";
import { loadPublicAssets } from "@/lib/bestchange/service";
import { getLiveTickers } from "@/lib/market/live";
import { loadHomepageReviews } from "@/lib/public-data";

export const revalidate = 0;

function getInitialPair(assets: Awaited<ReturnType<typeof loadPublicAssets>>["data"]) {
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

export default async function HomePage() {
  const marketPromise = getLiveTickers();
  const reviewsPromise = loadHomepageReviews();
  const publicAssets = await loadPublicAssets();
  const assets = publicAssets.data;
  const providerError = publicAssets.live ? undefined : publicAssets.error;

  const [market, reviewData] = await Promise.all([
    marketPromise,
    reviewsPromise
  ]);
  const { latestReviews, reviewAggregate, degraded } = reviewData;
  const { initialFrom, initialTo } = getInitialPair(assets);

  return (
    <AppShell sidebar={<div />} footer>
      <MonitorClient
        assets={assets}
        initialOffers={[]}
        initialTickers={market.tickers}
        marketLive={market.live}
        initialFrom={initialFrom}
        initialTo={initialTo}
        initialAmount={111}
        providerError={providerError}
        latestReviews={latestReviews.map((review) => ({
          ...review,
          createdAt: review.createdAt.toISOString(),
          user: { name: review.user?.name ?? "Пользователь RateScope" }
        }))}
        reviewAverage={reviewAggregate._avg.rating}
        reviewCount={reviewAggregate._count.rating}
        reviewsDegraded={degraded}
      />
    </AppShell>
  );
}
