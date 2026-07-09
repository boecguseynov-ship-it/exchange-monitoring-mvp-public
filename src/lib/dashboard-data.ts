import { ExchangeStatus, ModerationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type DashboardReview = {
  id: string;
  rating: number;
  body: string;
  status: string;
  transactionRef: string | null;
  createdAt: Date;
  exchange: {
    slug: string;
    name: string;
  };
  user: {
    name: string | null;
  } | null;
};

export type DashboardExchange = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: string;
  createdAt: Date;
  verifiedAt: Date | null;
  _count: {
    reviews: number;
  };
};

export type DashboardSnapshot = {
  degraded: boolean;
  counts: {
    activeExchanges: number;
    pendingReviews: number;
    publishedReviews: number;
    users: number;
    wikiEntries: number;
  };
  pendingReviews: DashboardReview[];
  latestReviews: DashboardReview[];
  exchanges: DashboardExchange[];
};

const emptySnapshot: DashboardSnapshot = {
  degraded: false,
  counts: {
    activeExchanges: 0,
    pendingReviews: 0,
    publishedReviews: 0,
    users: 0,
    wikiEntries: 0
  },
  pendingReviews: [],
  latestReviews: [],
  exchanges: []
};

export async function loadDashboardSnapshot(exchangeId?: string | null): Promise<DashboardSnapshot> {
  try {
    const exchangeFilter = exchangeId ? { id: exchangeId } : undefined;
    const reviewExchangeFilter = exchangeId ? { exchangeId } : undefined;

    const [
      activeExchanges,
      pendingReviewsCount,
      publishedReviews,
      users,
      wikiEntries,
      pendingReviews,
      latestReviews,
      exchanges
    ] = await Promise.all([
      prisma.exchange.count({ where: { status: ExchangeStatus.ACTIVE, ...exchangeFilter } }),
      prisma.review.count({ where: { status: ModerationStatus.PENDING, ...reviewExchangeFilter } }),
      prisma.review.count({ where: { status: ModerationStatus.PUBLISHED, ...reviewExchangeFilter } }),
      prisma.user.count(),
      prisma.wikiEntry.count(),
      prisma.review.findMany({
        where: { status: ModerationStatus.PENDING, ...reviewExchangeFilter },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          exchange: { select: { slug: true, name: true } },
          user: { select: { name: true } }
        }
      }),
      prisma.review.findMany({
        where: reviewExchangeFilter,
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          exchange: { select: { slug: true, name: true } },
          user: { select: { name: true } }
        }
      }),
      prisma.exchange.findMany({
        where: exchangeFilter,
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          slug: true,
          name: true,
          domain: true,
          status: true,
          createdAt: true,
          verifiedAt: true,
          _count: { select: { reviews: true } }
        }
      })
    ]);

    return {
      degraded: false,
      counts: {
        activeExchanges,
        pendingReviews: pendingReviewsCount,
        publishedReviews,
        users,
        wikiEntries
      },
      pendingReviews,
      latestReviews,
      exchanges
    };
  } catch {
    return { ...emptySnapshot, degraded: true };
  }
}

export function statusLabel(value: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Активен",
    PAUSED: "На паузе",
    HIDDEN: "Скрыт",
    PENDING: "На проверке",
    PUBLISHED: "Опубликован",
    REJECTED: "Отклонен"
  };

  return labels[value] ?? value;
}
