import Link from "next/link";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  Star,
  WalletCards,
  X
} from "lucide-react";
import { currencyDisplayMeta } from "@/components/currency-icon";
import type { AssetOption } from "./currency-sidebar";

export type InsightTicker = {
  code: string;
  name: string;
  usd: number;
  change24h: number;
};

export type InsightReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  user: { name: string };
  exchange: { name: string; slug: string };
};

function getTrustLevelLabel(average: number | null) {
  if (average === null) return "Нет оценок";
  if (average >= 4.5) return "Высокий уровень";
  if (average >= 3.5) return "Хороший уровень";
  if (average >= 2.5) return "Средний уровень";
  return "Низкий уровень";
}

const preferredTickerNetworks = ["", "BTC", "ERC-20", "ERC20", "TRC-20", "TRC20", "BEP-20", "BEP20", "SOL", "TON"];

function getTickerAsset(assets: AssetOption[], tickerCode: string) {
  const matches = assets.filter((asset) => {
    const meta = currencyDisplayMeta(asset.code, asset.name);
    return meta.displayCode === tickerCode;
  });

  return matches.sort((left, right) => {
    const leftMeta = currencyDisplayMeta(left.code, left.name);
    const rightMeta = currencyDisplayMeta(right.code, right.name);
    const leftRank = preferredTickerNetworks.indexOf(leftMeta.network ?? "");
    const rightRank = preferredTickerNetworks.indexOf(rightMeta.network ?? "");
    return (leftRank === -1 ? 999 : leftRank) - (rightRank === -1 ? 999 : rightRank);
  })[0];
}

function getTrustChecks({
  marketLive,
  reviewAverage,
  reviewCount,
  reviewsDegraded
}: {
  marketLive: boolean;
  reviewAverage: number | null;
  reviewCount: number;
  reviewsDegraded: boolean;
}) {
  return [
    {
      icon: Check,
      label: "Рыночные котировки",
      status: marketLive ? "Актуальны" : "Нет связи",
      ok: marketLive
    },
    {
      icon: LockKeyhole,
      label: "SSL шифрование",
      status: "Активно",
      ok: true
    },
    {
      icon: WalletCards,
      label: "Публичный рейтинг",
      status: reviewsDegraded
        ? "Временно недоступен"
        : reviewCount
          ? `${reviewCount.toLocaleString("ru-RU")} отзывов`
          : "Пока без отзывов",
      ok: !reviewsDegraded
    },
    {
      icon: Headphones,
      label: "Оценка доверия",
      status: reviewsDegraded
        ? "Нет данных"
        : getTrustLevelLabel(reviewAverage),
      ok: !reviewsDegraded && reviewAverage !== null && reviewAverage >= 3.5
    }
  ];
}
const chartShapes = [
  "0,19 8,18 16,20 24,15 32,17 40,10 48,13 56,7 64,10 72,6 80,9 88,4 96,7 104,5",
  "0,16 8,17 16,13 24,15 32,11 40,14 48,8 56,10 64,5 72,8 80,4 88,7 96,3 104,5",
  "0,18 8,17 16,19 24,14 32,16 40,12 48,15 56,9 64,11 72,6 80,9 88,5 96,7 104,4",
  "0,12 8,14 16,13 24,17 32,15 40,19 48,16 56,21 64,17 72,19 80,13 88,15 96,11 104,12"
];

function MiniSparkline({
  index,
  positive
}: {
  index: number;
  positive: boolean;
}) {
  const color = positive ? "#21b992" : "#ff6573";

  return (
    <svg
      className="marketSparkline"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 104 25"
    >
      <polyline
        fill="none"
        points={chartShapes[index % chartShapes.length]}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TrustGauge({
  average,
  count
}: {
  average: number | null;
  count: number;
}) {
  const safeAverage = average ?? 0;
  const progress = Math.max(0, Math.min(1, safeAverage / 5));
  const dash = 198 * progress;

  return (
    <div className="trustGauge">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 160 96">
        <path
          d="M20 80a60 60 0 0 1 120 0"
          fill="none"
          pathLength="198"
          stroke="#edf1f3"
          strokeLinecap="round"
          strokeWidth="12"
        />
        <path
          d="M20 80a60 60 0 0 1 120 0"
          fill="none"
          pathLength="198"
          stroke="#20af58"
          strokeDasharray={`${dash} 198`}
          strokeLinecap="round"
          strokeWidth="12"
        />
      </svg>
      <div>
        <strong>{average ? average.toFixed(1) : "—"}</strong>
        <span>{getTrustLevelLabel(average)}</span>
        <small>{count ? `На основе ${count.toLocaleString("ru-RU")} отзывов` : "Отзывы ещё не опубликованы"}</small>
      </div>
    </div>
  );
}

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Moscow"
  });
}

export function MonitorInsightRail({
  tickers,
  assets,
  marketLive,
  reviewAverage,
  reviewCount,
  latestReviews,
  reviewsDegraded,
  onMarketSelect
}: {
  tickers: InsightTicker[];
  assets: AssetOption[];
  marketLive: boolean;
  reviewAverage: number | null;
  reviewCount: number;
  latestReviews: InsightReview[];
  reviewsDegraded: boolean;
  onMarketSelect: (assetCode: string, tickerCode: string) => void;
}) {
  const visibleTickers = marketLive
    ? tickers.slice(0, 5)
    : tickers.slice(0, 5).map((ticker) => ({
        ...ticker,
        usd: 0,
        change24h: 0
      }));
  const trustChecks = getTrustChecks({
    marketLive,
    reviewAverage,
    reviewCount,
    reviewsDegraded
  });

  return (
    <aside className="monitorInsightRail" aria-label="Рыночная и репутационная информация">
      <section className="insightPanel marketToday">
        <header>
          <h2>Рынок сегодня</h2>
          <span className={marketLive ? "railLive" : "railLive degraded"}>
            {marketLive ? "Онлайн" : "Нет связи"}
          </span>
        </header>
        <div className="railTickerList">
          {visibleTickers.map((ticker, index) => {
            const hasMarketValue = marketLive && ticker.usd > 0;
            const tickerAsset = getTickerAsset(assets, ticker.code);

            return (
              <button
                aria-label={tickerAsset ? `Открыть предложения USDT к ${ticker.code}` : `${ticker.code}: валюта недоступна в мониторинге`}
                className="railTicker"
                disabled={!tickerAsset}
                key={ticker.code}
                onClick={() => tickerAsset && onMarketSelect(tickerAsset.code, ticker.code)}
                title={tickerAsset ? `Показать предложения для ${ticker.code}` : "Нет подходящей валюты в списке обмена"}
                type="button"
              >
                <strong>{ticker.code} <small>/ USDT</small></strong>
                <MiniSparkline index={index} positive={ticker.change24h >= 0} />
                <span>
                  <b>{hasMarketValue ? ticker.usd.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</b>
                  <small className={hasMarketValue ? (ticker.change24h >= 0 ? "positive" : "negative") : undefined}>
                    {hasMarketValue
                      ? `${ticker.change24h >= 0 ? "+" : ""}${ticker.change24h.toFixed(2)}%`
                      : "Нет данных"}
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="insightPanel trustPanel">
        <h2>Доверие и безопасность</h2>
        <TrustGauge average={reviewAverage} count={reviewCount} />
        <div className="securityChecks">
          {trustChecks.map((item) => {
            const Icon = item.ok ? item.icon : X;

            return (
              <div key={item.label}>
                <Icon size={14} />
                <span>{item.label}</span>
                <small>{item.status}</small>
              </div>
            );
          })}
        </div>
        <Link className="trustMore" href="/wiki">
          Как мы проверяем обменники <CircleHelp size={13} />
        </Link>
      </section>

      <section className="insightPanel recentReviews">
        <header>
          <h2>Последние отзывы</h2>
          <Link href="/exchangers">Смотреть все</Link>
        </header>
        {latestReviews.length ? (
          <div className="railReviewList">
            {latestReviews.map((review) => (
              <article className="railReview" key={review.id}>
                <div className="reviewAvatar">{review.user.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{review.user.name}</strong>
                  <Link href={`/exchangers/${review.exchange.slug}`}>
                    <BadgeCheck size={13} /> {review.exchange.name}
                  </Link>
                </div>
                <span><Star size={13} fill="currentColor" /> {review.rating}</span>
                <p>{review.body}</p>
                <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="railReviewEmpty">
            <ShieldCheck size={20} />
            <span>{reviewsDegraded ? "Отзывы временно недоступны" : "Опубликованных отзывов пока нет"}</span>
          </div>
        )}
      </section>
    </aside>
  );
}
