"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Filter,
  Grid2X2,
  Heart,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Users,
  WalletCards
} from "lucide-react";
import { currencyDisplayMeta } from "@/components/currency-icon";
import { CurrencySidebar, type AssetOption } from "./currency-sidebar";
import {
  MonitorInsightRail,
  type InsightReview
} from "./monitor-insight-rail";
import { AISafeDealPanel } from "./ai-safe-deal-panel";
import { formatOfferUpdatedTime, summarizeOffers } from "./offer-metrics";
import { assessOfferSecurity } from "./security-score";
import { CustomSelect } from "@/components/custom-select";


type Offer = {
  id: string;
  exchange: {
    name: string;
    slug: string;
    isDemo: boolean;
    rating: number | null;
    reviews: number;
    url: string;
    pageUrl?: string;
  };
  from: string;
  to: string;
  network?: string;
  rate: number;
  receivedAmount: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  kyc: string;
  processing: string;
  marks: string[];
  updatedAt: string;
};

type Ticker = { code: string; name: string; usd: number; change24h: number };

type InsightPayload = {
  tickers: Ticker[];
  marketLive: boolean;
  latestReviews: InsightReview[];
  reviewAverage: number | null;
  reviewCount: number;
  reviewsDegraded: boolean;
  updatedAt: string;
};

type RateAlert = {
  from: string;
  to: string;
  amount: number;
  rate: number | null;
  receivedAmount: number | null;
};

type ExchangeMode = "direct" | "multi";

type RouteQuote = {
  firstLeg?: Offer;
  secondLeg?: Offer;
  loading: boolean;
  error?: string;
};

const autoOffersRefreshMs = 15_000;
const autoInsightsRefreshMs = 30_000;
const favoritesStorageKey = "ratescope:favorites";
const alertStorageKey = "ratescope:rate-alert";

function firstDifferentAsset(assets: AssetOption[], excluded: string, fallback: string) {
  if (fallback && fallback !== excluded) return fallback;
  return assets.find((asset) => asset.code !== excluded)?.code ?? fallback;
}

function loadStoredFavorites() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const stored = window.localStorage.getItem(favoritesStorageKey);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function loadStoredAlert() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(alertStorageKey);
    return stored ? (JSON.parse(stored) as RateAlert) : null;
  } catch {
    return null;
  }
}

function processingLabel(processing: string) {
  if (processing === "AUTOMATIC") return "2–5 мин";
  if (processing === "SEMI_AUTOMATIC") return "5–15 мин";
  return "10–30 мин";
}

function formatRating(rating: number | null) {
  return rating === null ? "—" : rating.toFixed(1);
}

async function loadOffers({
  from,
  to,
  amount,
  signal
}: {
  from: string;
  to: string;
  amount: number;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    `/live-offers?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(String(amount))}`,
    {
      signal,
      cache: "no-store",
      headers: { accept: "application/json" }
    }
  );
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { message: response.status === 403 ? "Vercel Firewall проверяет запросы к live-курсам. Обновите страницу или попробуйте еще раз." : await response.text() };

  if (!response.ok) {
    throw new Error(payload.message ?? "Не удалось загрузить реальные предложения");
  }

  return (payload.data ?? []) as Offer[];
}

async function loadInsights(signal?: AbortSignal) {
  const response = await fetch("/api/v1/insights", {
    signal,
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("Не удалось обновить сводку мониторинга");
  return (await response.json()) as InsightPayload;
}

function formatSyncTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Moscow"
  });
}

export function MonitorClient({
  assets,
  initialOffers,
  initialTickers,
  marketLive,
  initialFrom,
  initialTo,
  initialAmount,
  providerError: initialProviderError,
  latestReviews,
  reviewAverage,
  reviewCount,
  reviewsDegraded
}: {
  assets: AssetOption[];
  initialOffers: Offer[];
  initialTickers: Ticker[];
  marketLive: boolean;
  initialFrom: string;
  initialTo: string;
  initialAmount: number;
  providerError?: string;
  latestReviews: InsightReview[];
  reviewAverage: number | null;
  reviewCount: number;
  reviewsDegraded: boolean;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => firstDifferentAsset(assets, initialFrom, initialTo));
  const [amountInput, setAmountInput] = useState(String(initialAmount));
  const [offers, setOffers] = useState(initialOffers);
  const [loading, setLoading] = useState(initialOffers.length === 0 && !initialProviderError);
  const [onlyNoKyc, setOnlyNoKyc] = useState(false);
  const [onlyAutomatic, setOnlyAutomatic] = useState(false);
  const [hideExtraFees, setHideExtraFees] = useState(false);
  const [exchangeMode, setExchangeMode] = useState<ExchangeMode>("direct");
  const [routeVia, setRouteVia] = useState(
    () => assets.find((asset) => asset.code !== initialFrom && asset.code !== initialTo)?.code ?? initialFrom
  );
  const [routeQuote, setRouteQuote] = useState<RouteQuote>({ loading: false });
  const [providerError, setProviderError] = useState(initialProviderError);
  const [liveTickers, setLiveTickers] = useState(initialTickers);
  const [liveMarketLive, setLiveMarketLive] = useState(marketLive);
  const [liveLatestReviews, setLiveLatestReviews] = useState(latestReviews);
  const [liveReviewAverage, setLiveReviewAverage] = useState(reviewAverage);
  const [liveReviewCount, setLiveReviewCount] = useState(reviewCount);
  const [liveReviewsDegraded, setLiveReviewsDegraded] = useState(reviewsDegraded);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshingOffers, setRefreshingOffers] = useState(false);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [routeRefreshTick, setRouteRefreshTick] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [rateAlert, setRateAlert] = useState<RateAlert | null>(null);
  const [widgetNotice, setWidgetNotice] = useState("");
  const [offersExpanded, setOffersExpanded] = useState(false);
  const firstRequest = useRef(true);
  const insightsRefreshInFlight = useRef(false);
  const ratesRef = useRef<HTMLElement>(null);
  const parsedAmount = Number(amountInput);
  const hasValidAmount = amountInput.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const amount = hasValidAmount ? parsedAmount : 0;
  const hasValidDirection = from !== to;

  const assetLabel = (asset: AssetOption) => {
    const meta = currencyDisplayMeta(asset.code, asset.name);
    return meta.network ? `${meta.displayCode} ${meta.network}` : meta.displayCode;
  };

  const refreshOffers = useCallback(async ({
    signal,
    showLoading = false
  }: {
    signal?: AbortSignal;
    showLoading?: boolean;
  } = {}) => {
    if (showLoading) setLoading(true);
    else setRefreshingOffers(true);

    try {
      setOffers(await loadOffers({ from, to, amount, signal }));
      setProviderError(undefined);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setOffers([]);
        setProviderError(error instanceof Error ? error.message : "Источник реальных предложений временно недоступен");
      }
    } finally {
      setLoading(false);
      setRefreshingOffers(false);
    }
  }, [amount, from, to]);

  const refreshInsights = useCallback(async (signal?: AbortSignal) => {
    if (insightsRefreshInFlight.current) return;
    insightsRefreshInFlight.current = true;
    setRefreshingInsights(true);

    try {
      const payload = await loadInsights(signal);
      setLiveTickers(payload.tickers);
      setLiveMarketLive(payload.marketLive);
      setLiveLatestReviews(payload.latestReviews);
      setLiveReviewAverage(payload.reviewAverage);
      setLiveReviewCount(payload.reviewCount);
      setLiveReviewsDegraded(payload.reviewsDegraded);
      setLastSyncedAt(payload.updatedAt);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setLiveMarketLive(false);
        setLiveReviewsDegraded(true);
      }
    } finally {
      insightsRefreshInFlight.current = false;
      setRefreshingInsights(false);
    }
  }, []);

  const refreshNow = async () => {
    if (!hasValidAmount || !hasValidDirection) return;
    if (exchangeMode === "multi") setRouteRefreshTick((tick) => tick + 1);
    await Promise.all([
      refreshOffers({ showLoading: false }),
      refreshInsights()
    ]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFavorites(loadStoredFavorites());
      setRateAlert(loadStoredAlert());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasValidDirection) {
      const timer = window.setTimeout(() => {
        setLoading(false);
        setOffers([]);
        setProviderError("Выберите разные валюты для обмена");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!hasValidAmount) {
      const timer = window.setTimeout(() => {
        setLoading(false);
        setOffers([]);
        setProviderError("Введите сумму больше нуля");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void refreshOffers({ signal: controller.signal, showLoading: true });
    }, firstRequest.current ? 0 : 250);

    firstRequest.current = false;

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [from, to, amount, hasValidAmount, hasValidDirection, refreshOffers]);

  const fallbackRouteVia = assets.find((asset) => asset.code !== from && asset.code !== to)?.code ?? from;
  const activeRouteVia = routeVia !== from && routeVia !== to ? routeVia : fallbackRouteVia;

  useEffect(() => {
    if (exchangeMode !== "multi" || !hasValidAmount || !hasValidDirection || activeRouteVia === from || activeRouteVia === to) {
      const timer = window.setTimeout(() => setRouteQuote({ loading: false }), 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRouteQuote({ loading: true });

      try {
        const firstLeg = (await loadOffers({
          from,
          to: activeRouteVia,
          amount,
          signal: controller.signal
        }))[0];
        if (!firstLeg) {
          setRouteQuote({ loading: false, error: "Нет предложения для первого шага маршрута" });
          return;
        }

        const secondLeg = (await loadOffers({
          from: activeRouteVia,
          to,
          amount: firstLeg.receivedAmount,
          signal: controller.signal
        }))[0];
        setRouteQuote(
          secondLeg
            ? { firstLeg, secondLeg, loading: false }
            : { firstLeg, loading: false, error: "Нет предложения для второго шага маршрута" }
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRouteQuote({
            loading: false,
            error: error instanceof Error ? error.message : "Не удалось рассчитать маршрут"
          });
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [amount, exchangeMode, from, activeRouteVia, to, hasValidAmount, hasValidDirection, routeRefreshTick]);

  useEffect(() => {
    if (!autoRefreshEnabled || !hasValidAmount || !hasValidDirection) return;

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void refreshOffers({ showLoading: false });
      if (exchangeMode === "multi") setRouteRefreshTick((tick) => tick + 1);
    }, autoOffersRefreshMs);

    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, exchangeMode, hasValidAmount, hasValidDirection, refreshOffers]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void refreshInsights();
    }, autoInsightsRefreshMs);

    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, refreshInsights]);

  const visibleOffers = useMemo(
    () =>
      offers.filter(
        (offer) =>
          (!onlyNoKyc || offer.kyc === "NONE") &&
          (!onlyAutomatic || offer.processing === "AUTOMATIC") &&
          (!hideExtraFees || !offer.marks.includes("percent"))
      ),
    [hideExtraFees, offers, onlyAutomatic, onlyNoKyc]
  );
  const bestOffer = visibleOffers[0];
  const offerMetrics = useMemo(
    () => summarizeOffers(visibleOffers),
    [visibleOffers]
  );
  const displayedOffers = offersExpanded
    ? visibleOffers
    : visibleOffers.slice(0, 7);
  const lastUpdatedAt = formatOfferUpdatedTime(bestOffer?.updatedAt);
  const syncLabel = formatSyncTime(lastSyncedAt, lastUpdatedAt);
  const isRealtimeRefreshing = refreshingOffers || refreshingInsights || routeQuote.loading;
  const quoteAmount =
    exchangeMode === "multi" ? routeQuote.secondLeg?.receivedAmount : bestOffer?.receivedAmount;
  const favoriteKey = `${from}:${to}`;
  const alertMatchesCurrentPair = rateAlert?.from === from && rateAlert.to === to && rateAlert.amount === amount;

  useEffect(() => {
    if (!rateAlert || !bestOffer) return;
    if (rateAlert.from !== from || rateAlert.to !== to || rateAlert.amount !== amount) return;
    if (rateAlert.receivedAmount === null || bestOffer.receivedAmount <= rateAlert.receivedAmount) return;

    const message = `Курс улучшился: ${amount.toLocaleString("ru-RU")} ${from} = ${bestOffer.receivedAmount.toFixed(4)} ${to}`;
    const updatedAlert = {
      ...rateAlert,
      rate: bestOffer.rate,
      receivedAmount: bestOffer.receivedAmount
    };

    const timer = window.setTimeout(() => {
      setWidgetNotice(message);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("RateScope: курс улучшился", { body: message });
      }
      setRateAlert(updatedAlert);
      window.localStorage.setItem(alertStorageKey, JSON.stringify(updatedAlert));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [amount, bestOffer, from, rateAlert, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleFromChange = (code: string) => {
    setFrom(code);
    if (code === to) setTo(firstDifferentAsset(assets, code, from));
  };

  const handleToChange = (code: string) => {
    setTo(code);
    if (code === from) setFrom(firstDifferentAsset(assets, code, to));
  };

  const openMarketTicker = (assetCode: string, tickerCode: string) => {
    const preferredSourceCodes = ["USDTTRC20", "USDTBEP20", "USDTERC20", "USDCERC20"];
    const preferredFrom =
      preferredSourceCodes.find((code) => code !== assetCode && assets.some((asset) => asset.code === code)) ??
      assets.find((asset) => asset.code !== assetCode)?.code ??
      from;
    const targetAsset = assets.find((asset) => asset.code === assetCode);

    setExchangeMode("direct");
    setFrom(preferredFrom);
    setTo(assetCode);
    setOffersExpanded(false);
    setRouteQuote({ loading: false });
    setWidgetNotice(`Открыто направление для ${targetAsset ? assetLabel(targetAsset) : tickerCode}`);
    window.setTimeout(() => ratesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const toggleFavorite = () => {
    const nextFavorites = new Set(favorites);
    if (nextFavorites.has(favoriteKey)) {
      nextFavorites.delete(favoriteKey);
      setWidgetNotice(`${from} → ${to} удалено из избранного`);
    } else {
      nextFavorites.add(favoriteKey);
      setWidgetNotice(`${from} → ${to} добавлено в избранное`);
    }
    setFavorites(nextFavorites);
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify([...nextFavorites]));
    window.dispatchEvent(new Event("ratescope:favorites-changed"));
  };

  const toggleRateAlert = async () => {
    if (alertMatchesCurrentPair) {
      setRateAlert(null);
      window.localStorage.removeItem(alertStorageKey);
      setWidgetNotice(`Оповещение для ${from} → ${to} отключено`);
      return;
    }

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    const nextAlert = {
      from,
      to,
      amount,
      rate: bestOffer?.rate ?? null,
      receivedAmount: bestOffer?.receivedAmount ?? null
    };
    setRateAlert(nextAlert);
    window.localStorage.setItem(alertStorageKey, JSON.stringify(nextAlert));
    setWidgetNotice(`Оповещение включено для ${amount.toLocaleString("ru-RU")} ${from} → ${to}`);
  };

  const quickDirections = useMemo(() => {
    const available = new Set(assets.map((asset) => asset.code));
    return [
      { from: "RUB", to: "USDTTRC20", label: "RUB → USDT", text: "популярное направление" },
      { from: "USDTTRC20", to: "RUB", label: "USDT → RUB", text: "обратный обмен" },
      { from: "BTCBEP20", to: "USDTTRC20", label: "BTC → USDT", text: "сравнить курс к стейблкоину" },
      { from: "ETHBEP20", to: "USDCERC20", label: "ETH → USDC", text: "быстрая проверка рынка" }
    ].filter((direction) => available.has(direction.from) && available.has(direction.to));
  }, [assets]);

  const openQuickDirection = (direction: { from: string; to: string }) => {
    handleFromChange(direction.from);
    handleToChange(direction.to);
    window.setTimeout(() => ratesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <>
      <CurrencySidebar assets={assets} from={from} to={to} onFrom={handleFromChange} onTo={handleToChange} onSwap={swap} />
      <div className="monitorContent referenceDashboard">
        <div className="monitorDashboard">
          <div className="monitorPrimary">
            <section className="monitorWorkspace">
          <header className="workspaceHeader">
            <div>
              <h1>Мониторинг обменников</h1>
              <span className={providerError ? "workspaceLive degraded" : "workspaceLive"}>
                <i /> {providerError ? "Источник предложений временно недоступен" : autoRefreshEnabled ? "Данные обновляются в реальном времени" : "Автообновление на паузе"}
              </span>
            </div>
            <div className="workspaceRealtime">
              <span className="workspaceUpdated"><Clock3 size={15} /> Обновлено: {syncLabel}</span>
              <button
                className={isRealtimeRefreshing ? "realtimeRefresh refreshing" : "realtimeRefresh"}
                disabled={isRealtimeRefreshing || !hasValidAmount || !hasValidDirection}
                onClick={refreshNow}
                title="Обновить сейчас"
                type="button"
              >
                <RefreshCw size={15} />
                <span>Сейчас</span>
              </button>
              <button
                aria-pressed={autoRefreshEnabled}
                className={autoRefreshEnabled ? "realtimeToggle active" : "realtimeToggle"}
                onClick={() => setAutoRefreshEnabled((enabled) => !enabled)}
                title={autoRefreshEnabled ? "Остановить автообновление" : "Включить автообновление"}
                type="button"
              >
                <i />
                <span>Онлайн</span>
              </button>
            </div>
          </header>

          <div className="exchangeWidget">
            <div className="exchangeFields">
              <div>
                <label>Отдаю</label>
                <div className="amountField">
                  <input
                    value={amountInput}
                    min={1}
                    type="number"
                    placeholder="Сумма"
                    onChange={(event) => setAmountInput(event.target.value)}
                  />
                  <CustomSelect
                    value={from}
                    onChange={handleFromChange}
                    options={assets.map((asset) => ({ value: asset.code, label: assetLabel(asset) }))}
                  />
                </div>
              </div>
              <button className="swapRound" onClick={swap} aria-label="Поменять направление"><ArrowDownUp size={18} /></button>
              <div>
                <label>Получаю</label>
                <div className="amountField">
                  <input
                    readOnly
                    value={quoteAmount ? quoteAmount.toFixed(4) : ""}
                    placeholder={exchangeMode === "multi" && routeQuote.loading ? "Маршрут..." : "Сумма"}
                  />
                  <CustomSelect
                    value={to}
                    onChange={handleToChange}
                    options={assets.map((asset) => ({ value: asset.code, label: assetLabel(asset) }))}
                  />
                </div>
              </div>
            </div>
            {exchangeMode === "multi" && (
              <div className="routePanel">
                <label>
                  Через
                  <CustomSelect
                    value={activeRouteVia}
                    onChange={setRouteVia}
                    variant="compact"
                    options={assets
                      .filter((asset) => asset.code !== from && asset.code !== to)
                      .map((asset) => ({ value: asset.code, label: assetLabel(asset) }))}
                  />
                </label>
                <span>
                  {routeQuote.loading && "Рассчитываем маршрут"}
                  {!routeQuote.loading && routeQuote.error}
                  {!routeQuote.loading && !routeQuote.error && routeQuote.firstLeg && routeQuote.secondLeg &&
                    `${amount.toLocaleString("ru-RU")} ${from} → ${routeQuote.firstLeg.receivedAmount.toFixed(4)} ${activeRouteVia} → ${routeQuote.secondLeg.receivedAmount.toFixed(4)} ${to}`}
                </span>
              </div>
            )}
            {widgetNotice && <p className="widgetNotice" role="status">{widgetNotice}</p>}
          </div>

          <div className="quickFilters" aria-label="Быстрые фильтры">
            <button
              type="button"
              onClick={() => setExchangeMode((mode) => mode === "direct" ? "multi" : "direct")}
              aria-pressed={exchangeMode === "multi"}
            >
              <Grid2X2 size={16} /> {exchangeMode === "direct" ? "Все способы" : "Многошаговый"}
            </button>
            <button type="button" onClick={() => setOnlyNoKyc((value) => !value)} aria-pressed={onlyNoKyc}>
              <ShieldCheck size={16} /> Без проверки KYC
            </button>
            <button type="button" onClick={() => setOnlyAutomatic((value) => !value)} aria-pressed={onlyAutomatic}>
              <RefreshCw size={16} /> Автоматические
            </button>
            <button type="button" onClick={() => setHideExtraFees((value) => !value)} aria-pressed={hideExtraFees}>
              <CircleDollarSign size={16} /> Без доп. комиссии
            </button>
            <button
              className={alertMatchesCurrentPair ? "quickIconAction active" : "quickIconAction"}
              type="button"
              onClick={toggleRateAlert}
              aria-label={alertMatchesCurrentPair ? "Отключить оповещение" : "Оповестить о курсе"}
              title={alertMatchesCurrentPair ? "Оповещение включено" : "Оповестить о курсе"}
            >
              <Bell size={16} />
            </button>
            <button
              aria-label={favorites.has(favoriteKey) ? "Удалить из избранного" : "Добавить в избранное"}
              className={favorites.has(favoriteKey) ? "quickIconAction active" : "quickIconAction"}
              type="button"
              onClick={toggleFavorite}
              title={favorites.has(favoriteKey) ? "Удалить из избранного" : "Добавить в избранное"}
            >
              <Heart size={16} fill={favorites.has(favoriteKey) ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="monitorMetrics">
            <div>
              <Users size={19} />
              <span>Найдено обменников</span>
              <strong>{offerMetrics.count}</strong>
            </div>
            <div>
              <Search size={19} />
              <span>Лучшее получение</span>
              <strong>{offerMetrics.bestReceivedAmount ? offerMetrics.bestReceivedAmount.toFixed(4) : "—"} {to}</strong>
            </div>
            <div>
              <CircleDollarSign size={19} />
              <span>Среднее получение</span>
              <strong>{offerMetrics.averageReceivedAmount ? offerMetrics.averageReceivedAmount.toFixed(4) : "—"} {to}</strong>
            </div>
            <div>
              <WalletCards size={19} />
              <span>Общий резерв</span>
              <strong>{offerMetrics.totalReserve ? offerMetrics.totalReserve.toLocaleString("ru-RU") : "—"} {to}</strong>
            </div>
          </div>

          <AISafeDealPanel
            offers={visibleOffers}
            amount={amount}
            from={from}
            to={to}
            loading={loading || refreshingOffers}
            providerError={providerError}
          />
        </section>

        <section className="ratesCard" ref={ratesRef}>
          <div className={offersExpanded ? "offerTable expanded" : "offerTable"}>
            <div className="offerHeader">
              <span>Обменник</span>
              <span>Рейтинг</span>
              <span>Проверка</span>
              <span>Отдаёте</span>
              <span>Получаете</span>
              <span>Резерв</span>
              <span>Время</span>
              <span>Действия</span>
            </div>
            {loading && <div className="tableNotice">Обновляем предложения…</div>}
            {!loading && providerError && (
              <div className="emptyOffers providerError">
                <Filter size={28} />
                <strong>Реальные предложения сейчас недоступны</strong>
                <span>{providerError}</span>
                <small>Проверьте ключ live-провайдера в файле .env и перезапустите сайт.</small>
              </div>
            )}
            {!loading && !providerError && visibleOffers.length === 0 && (
              <div className="emptyOffers">
                <Filter size={28} />
                <strong>Для этой суммы и направления предложений нет</strong>
                <span>Попробуйте изменить сумму или выбрать другую валютную пару.</span>
              </div>
            )}
            {displayedOffers.map((offer) => {
              const security = assessOfferSecurity({
                kyc: offer.kyc,
                processing: offer.processing,
                rating: offer.exchange.rating,
                reviews: offer.exchange.reviews,
                reserve: offer.reserve,
                updatedAt: offer.updatedAt,
                verified: !offer.exchange.isDemo
              });

              return (
              <div className="offerRow" key={offer.id}>
                <span className="exchangeName">
                  <i>{offer.exchange.name.slice(0, 1).toUpperCase()}</i>
                  <span>
                    <a href={offer.exchange.url}>
                      <strong>{offer.exchange.name}</strong>
                    </a>
                    <small><BadgeCheck size={12} /> Проверен</small>
                  </span>
                </span>
                <span className="rating">
                  {offer.exchange.rating === null ? (
                    <strong className="ratingMissing">нет оценки</strong>
                  ) : (
                    <strong><Star size={14} fill="currentColor" /> {formatRating(offer.exchange.rating)}</strong>
                  )}
                  <small>{offer.exchange.reviews} отзывов</small>
                </span>
                <span className={`securityCell ${security.amlTone}`} title={security.reasons.join(" · ")}>
                  <strong><ShieldCheck size={13} /> {security.score}/100</strong>
                  <small>{security.kycLabel}</small>
                  <small>{security.amlLabel}</small>
                </span>
                <span><strong>{amount.toLocaleString("ru-RU")} {from}</strong><small>Мин. {offer.minAmount.toLocaleString("ru-RU")}</small></span>
                <span className="receivedCell">
                  <strong>{offer.receivedAmount.toFixed(4)} {to}</strong>
                  <small className={offer.id === bestOffer?.id ? "bestRate" : undefined}>
                    {offer.id === bestOffer?.id ? "Лучшая цена" : `1 ${from} = ${offer.rate} ${to}`}
                  </small>
                </span>
                <span><strong>{offer.reserve.toLocaleString("ru-RU")}</strong><small>{offer.network ?? to}</small></span>
                <span className="processingCell"><i /><strong>{processingLabel(offer.processing)}</strong></span>
                <span className="offerActions">
                  <a href={offer.exchange.url}>
                    Перейти <ExternalLink size={12} />
                  </a>
                  <button type="button" aria-label={`Добавить ${offer.exchange.name} в закладки`}>
                    <Bookmark size={16} />
                  </button>
                </span>
              </div>
              );
            })}
            {visibleOffers.length > 7 && (
              <button
                className="showMoreOffers"
                type="button"
                onClick={() => setOffersExpanded((expanded) => !expanded)}
              >
                {offersExpanded ? "Скрыть дополнительные предложения" : `Показать ещё ${visibleOffers.length - 7} обменников`}
                <ChevronDown size={14} className={offersExpanded ? "expanded" : undefined} />
              </button>
            )}
          </div>
        </section>

        <section className="howBestchange" aria-label="Как использовать RateScope">
          <h2>Как использовать RateScope?</h2>
          <div className="howBestchangeCards">
            <article className="howBestchangeCard">
              <span className="howBestchangeIcon" aria-hidden="true"><Search size={22} /></span>
              <div>
                <strong>Найти</strong>
                <small>нужное направление обмена</small>
              </div>
            </article>
            <article className="howBestchangeCard">
              <span className="howBestchangeIcon" aria-hidden="true"><CircleDollarSign size={22} /></span>
              <div>
                <strong>Сравнить</strong>
                <small>курсы, лимиты и резерв</small>
              </div>
            </article>
            <article className="howBestchangeCard">
              <span className="howBestchangeIcon" aria-hidden="true"><BadgeCheck size={22} /></span>
              <div>
                <strong>Проверить</strong>
                <small>отзывы и репутацию</small>
              </div>
            </article>
          </div>
        </section>

        <section className="homepageFillPanel" aria-label="Быстрые действия RateScope">
          <div>
            <h2>Быстрые направления</h2>
            <p>Откройте частые пары в один клик и сразу сравните курс, резерв и условия обменников.</p>
          </div>
          <div className="quickDirectionGrid">
            {quickDirections.map((direction) => (
              <button key={`${direction.from}-${direction.to}`} type="button" onClick={() => openQuickDirection(direction)}>
                <ArrowDownUp size={16} />
                <span>
                  <strong>{direction.label}</strong>
                  <small>{direction.text}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="fillFeatureGrid">
            <span><ShieldCheck size={16} /><strong>Проверки</strong><small>смотрите риск-метки до перехода</small></span>
            <span><RefreshCw size={16} /><strong>Онлайн-обновления</strong><small>данные подтягиваются автоматически</small></span>
            <span><Star size={16} /><strong>Репутация</strong><small>учитывайте отзывы и статус проверки</small></span>
          </div>
        </section>
          </div>

          <MonitorInsightRail
            tickers={liveTickers}
            assets={assets}
            marketLive={liveMarketLive}
            reviewAverage={liveReviewAverage}
            reviewCount={liveReviewCount}
            latestReviews={liveLatestReviews}
            reviewsDegraded={liveReviewsDegraded}
            onMarketSelect={openMarketTicker}
          />
        </div>
      </div>
    </>
  );
}
