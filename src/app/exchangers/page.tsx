import { AdBanner } from "@/components/ad-banner";
import { AppShell } from "@/components/app-shell";
import { loadLiveExchangeDirectory } from "@/lib/bestchange/service";
import { localChangers } from "@/lib/bestchange/local";
import { normalizeBestChangeDirectory } from "@/lib/bestchange/normalize";
import { prisma } from "@/lib/db/prisma";
import { ExchangeDirectoryClient, type ExchangeDirectoryItem } from "./exchange-directory-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Обменные пункты — monik exchange"
};

async function loadDirectory() {
  try {
    return await loadLiveExchangeDirectory();
  } catch {
    return normalizeBestChangeDirectory(localChangers, new Map());
  }
}

function averageRating(items: ExchangeDirectoryItem[]) {
  const rated = items.filter((item) => item.rating !== null && item.reviews > 0);
  if (!rated.length) return null;
  return rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length;
}

export default async function ExchangersPage() {
  const exchangers = await loadDirectory();

  const activeExchanges = await prisma.exchange.findMany({
    where: { status: "ACTIVE" },
    include: {
      _count: {
        select: {
          reviews: { where: { status: "PUBLISHED" } }
        }
      }
    }
  });

  const localReviews = await prisma.review.groupBy({
    by: ["exchangeId"],
    where: { status: "PUBLISHED" },
    _count: { id: true },
    _avg: { rating: true }
  });

  const ratingMap = new Map(localReviews.map(r => [r.exchangeId, r._avg.rating ?? null]));
  const reviewCountBySlug = new Map<string, number>();
  for (const agg of localReviews) {
    const exchange = activeExchanges.find(e => e.id === agg.exchangeId);
    if (exchange) {
      reviewCountBySlug.set(exchange.slug, agg._count.id);
    }
  }

  // Find database exchanges that are not present in the BestChange API feed
  const matchedSlugs = new Set(exchangers.map(e => e.slug));
  const unmatchedExchangers = activeExchanges
    .filter(db => !matchedSlugs.has(db.slug))
    .map(db => {
      const rating = ratingMap.get(db.id) ?? null;
      const reviewsCount = db._count.reviews;
      const insuranceDeposit = db.insuranceDeposit;
      let reserve = 50000;
      if (insuranceDeposit) {
        const num = Number(insuranceDeposit.replace(/[^\d]/g, ""));
        if (Number.isFinite(num) && num > 0) reserve = num;
      }

      return {
        slug: db.slug,
        name: db.name,
        description: db.description || "Профиль обменника",
        domain: db.domain || "",
        searchText: [db.name, db.slug, db.domain].filter(Boolean).join(" "),
        rating,
        reviews: reviewsCount,
        reserve,
        verified: true,
        url: `https://${db.domain}`,
        pageUrl: `/exchangers/${db.slug}`
      };
    });

  const insuranceDepositBySlug = new Map(activeExchanges.map(e => [e.slug, e.insuranceDeposit]));
  const mergedExchangers = [...exchangers, ...unmatchedExchangers];

  const directoryItems: ExchangeDirectoryItem[] = mergedExchangers
    .map((exchange) => {
      const insuranceDeposit = (exchange as any).insuranceDeposit ?? insuranceDepositBySlug.get(exchange.slug) ?? null;
      return {
        keyId: [
          exchange.slug,
          exchange.name,
          exchange.url,
          exchange.pageUrl
        ].filter(Boolean).join(":"),
        slug: exchange.slug,
        name: exchange.name,
        description: [
          exchange.verified ? "Активен" : "Наблюдение",
          `резерв ${exchange.reserve.toLocaleString("ru-RU")} $`,
          exchange.domain
        ].filter(Boolean).join(" · "),
        rating: exchange.rating,
        reviews: reviewCountBySlug.get(exchange.slug) ?? 0,
        reserve: exchange.reserve,
        verified: exchange.verified,
        status: exchange.verified ? "Активен" : "Наблюдение",
        href: exchange.pageUrl || `/exchangers/${exchange.slug}`,
        insuranceDeposit,
        searchText: [
          exchange.name,
          exchange.slug,
          exchange.domain,
          exchange.url,
          exchange.pageUrl
        ].filter(Boolean).join(" ")
      };
    })
    .sort((left, right) =>
      right.reviews - left.reviews ||
      Number(right.verified) - Number(left.verified) ||
      left.name.localeCompare(right.name, "ru")
    );

  const reviewedCount = directoryItems.filter((exchange) => exchange.reviews > 0).length;
  const totalReserve = directoryItems.reduce((sum, exchange) => sum + exchange.reserve, 0);
  const rating = averageRating(directoryItems);

  return (
    <AppShell footer>
      <section className="publicPage directoryPage">
        <h1>Все обменные пункты</h1>
        <p className="publicLead">
          Каталог live-обменников с резервами, статусом, рейтингом и отзывами пользователей monik exchange.
        </p>
        <AdBanner placement="catalog-top" />
        <div className="directorySummary">
          <div><strong>{directoryItems.length.toLocaleString("ru-RU")}</strong><span>обменников в каталоге</span></div>
          <div><strong>{reviewedCount.toLocaleString("ru-RU")}</strong><span>с отзывами monik exchange</span></div>
          <div><strong>{rating === null ? "нет" : rating.toFixed(1)}</strong><span>средний рейтинг</span></div>
          <div><strong>{totalReserve.toLocaleString("ru-RU")}</strong><span>общий резерв, $</span></div>
        </div>
        <ExchangeDirectoryClient exchangers={directoryItems} />
      </section>
    </AppShell>
  );
}
