"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CircleCheck, Search, Star } from "lucide-react";

export type ExchangeDirectoryItem = {
  keyId: string;
  slug: string;
  name: string;
  description: string;
  rating: number | null;
  reviews: number;
  reserve: number;
  verified: boolean;
  status: string;
  href: string;
  searchText?: string;
  insuranceDeposit?: string | null;
};

type ReviewFilter = "all" | "reviewed" | "deposit" | "empty";

function formatReserve(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatRating(value: number | null) {
  return value === null ? "нет оценки" : value.toFixed(1);
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\bwww\./gi, "");
}

function parseDepositValue(value: string | null | undefined): number {
  if (!value) return 0;
  const num = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function compactUrlSearchText(value: string) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/gi, "");
}

export function ExchangeDirectoryClient({
  exchangers
}: {
  exchangers: ExchangeDirectoryItem[];
}) {
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = compactUrlSearchText(query);
  const reviewedCount = exchangers.filter((exchange) => exchange.reviews > 0).length;
  const depositCount = exchangers.filter((exchange) => Boolean(exchange.insuranceDeposit)).length;

  const visibleExchangers = useMemo(() => {
    const filtered = exchangers.filter((exchange) => {
      const searchText = `${exchange.name} ${exchange.description} ${exchange.slug} ${exchange.searchText ?? ""} ${exchange.insuranceDeposit ?? ""}`;
      const normalizedSearchText = normalizeSearchText(searchText);
      const matchesQuery = normalizedQuery
        ? normalizedSearchText.includes(normalizedQuery) ||
          (compactQuery.length > 1 && compactUrlSearchText(searchText).includes(compactQuery))
        : true;
      const matchesReviews =
        reviewFilter === "all" ||
        (reviewFilter === "reviewed" && exchange.reviews > 0) ||
        (reviewFilter === "deposit" && Boolean(exchange.insuranceDeposit)) ||
        (reviewFilter === "empty" && exchange.reviews === 0);

      return matchesQuery && matchesReviews;
    });

    if (reviewFilter === "deposit") {
      return [...filtered].sort((left, right) => {
        const leftDep = parseDepositValue(left.insuranceDeposit);
        const rightDep = parseDepositValue(right.insuranceDeposit);
        if (leftDep !== rightDep) {
          return rightDep - leftDep;
        }
        return right.reviews - left.reviews || left.name.localeCompare(right.name, "ru");
      });
    }

    return filtered;
  }, [compactQuery, exchangers, normalizedQuery, reviewFilter]);

  return (
    <div id="catalog">
      <div className="directoryToolbar">
        <label className="contentSearch">
          <Search size={18} />
          <input
            placeholder="Поиск по обменным пунктам"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="directoryFilterTabs" aria-label="Фильтр отзывов">
          <button type="button" onClick={() => setReviewFilter("all")} aria-pressed={reviewFilter === "all"}>
            Все
          </button>
          <button type="button" onClick={() => setReviewFilter("reviewed")} aria-pressed={reviewFilter === "reviewed"}>
            С отзывами <small>{reviewedCount}</small>
          </button>
          <button type="button" onClick={() => setReviewFilter("deposit")} aria-pressed={reviewFilter === "deposit"}>
            С депозитом <small>{depositCount}</small>
          </button>
          <button type="button" onClick={() => setReviewFilter("empty")} aria-pressed={reviewFilter === "empty"}>
            Без отзывов
          </button>
        </div>
      </div>

      <div className="directoryTable" role="table" aria-label="Обменные пункты">
        <div className="directoryHead" role="row">
          <span>Название</span>
          <span>Рейтинг</span>
          <span>Статус</span>
          <span>Резерв</span>
          <span>Отзывы monik exchange</span>
        </div>
        {visibleExchangers.map((exchange, index) => (
          <Link className="directoryRow" href={exchange.href} key={exchange.keyId} role="row">
            <span className="directoryName">
              <small>{index + 1}</small>
              <i>{exchange.name.slice(0, 1).toUpperCase()}</i>
              <span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong>{exchange.name}</strong>
                  {exchange.insuranceDeposit && (
                    <span className="depositBadge" style={{
                      fontSize: "11px",
                      background: "rgba(249, 115, 22, 0.15)",
                      color: "#f97316",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      border: "1px solid rgba(249, 115, 22, 0.3)"
                    }}>
                      Депозит {exchange.insuranceDeposit}
                    </span>
                  )}
                </div>
                <small>{exchange.description}</small>
              </span>
            </span>
            <span className={exchange.rating === null ? "directoryRating empty" : "directoryRating"}>
              {exchange.rating === null ? (
                "нет оценки"
              ) : (
                <>
                  <Star size={15} fill="currentColor" /> {formatRating(exchange.rating)}
                </>
              )}
            </span>
            <span className={exchange.verified ? "directoryStatus" : "directoryStatus disabled"}>
              <CircleCheck size={15} /> {exchange.status}
            </span>
            <strong>{formatReserve(exchange.reserve)}</strong>
            <span className={exchange.reviews > 0 ? "directoryReviews" : "directoryReviews empty"}>
              <strong>{exchange.reviews.toLocaleString("ru-RU")}</strong>
              <small>{exchange.reviews > 0 ? "Открыть отзывы" : "нет отзывов"}</small>
            </span>
          </Link>
        ))}
        {!visibleExchangers.length && (
          <div className="directoryEmpty">Обменные пункты не найдены</div>
        )}
      </div>
    </div>
  );
}
