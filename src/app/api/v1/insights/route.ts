import { NextResponse } from "next/server";
import { getLiveTickers } from "@/lib/market/live";
import { loadHomepageReviews } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const [market, reviews] = await Promise.all([
    getLiveTickers(),
    loadHomepageReviews()
  ]);

  return NextResponse.json({
    tickers: market.tickers,
    marketLive: market.live,
    latestReviews: reviews.latestReviews.map((review) => ({
      ...review,
      createdAt: review.createdAt.toISOString(),
      user: { name: review.user?.name ?? "Пользователь RateScope" }
    })),
    reviewAverage: reviews.reviewAggregate._avg.rating,
    reviewCount: reviews.reviewAggregate._count.rating,
    reviewsDegraded: reviews.degraded,
    updatedAt: market.updatedAt
  });
}
