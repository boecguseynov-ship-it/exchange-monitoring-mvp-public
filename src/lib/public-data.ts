import { ModerationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type ReviewAggregate = {
  _avg: { rating: number | null };
  _count: { rating: number };
};

type ReviewLoaderResult<T> = {
  latestReviews: T[];
  reviewAggregate: ReviewAggregate;
  degraded: boolean;
};

export const realPublishedReviewWhere = {
  status: ModerationStatus.PUBLISHED,
  exchange: { isDemo: false }
} satisfies Prisma.ReviewWhereInput;

function databaseContentEnabled() {
  return process.env.RATESCOPE_USE_DB_CONTENT === "1";
}

export function createHomepageReviewLoader<T>({
  findMany,
  aggregate
}: {
  findMany: () => Promise<T[]>;
  aggregate: () => Promise<ReviewAggregate>;
}) {
  return async (): Promise<ReviewLoaderResult<T>> => {
    if (!databaseContentEnabled()) {
      return {
        latestReviews: [] as T[],
        reviewAggregate: {
          _avg: { rating: null },
          _count: { rating: 0 }
        },
        degraded: false
      };
    }

    try {
      const [latestReviews, reviewAggregate] = await Promise.all([
        findMany(),
        aggregate()
      ]);
      return { latestReviews, reviewAggregate, degraded: false };
    } catch {
      return {
        latestReviews: [] as T[],
        reviewAggregate: {
          _avg: { rating: null },
          _count: { rating: 0 }
        },
        degraded: true
      };
    }
  };
}

export const loadHomepageReviews = createHomepageReviewLoader({
  findMany: () => prisma.review.findMany({
    where: realPublishedReviewWhere,
    orderBy: { createdAt: "desc" },
    take: 2,
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      user: { select: { name: true } },
      exchange: { select: { name: true, slug: true } }
    }
  }),
  aggregate: () => prisma.review.aggregate({
    where: realPublishedReviewWhere,
    _avg: { rating: true },
    _count: { rating: true }
  })
});
