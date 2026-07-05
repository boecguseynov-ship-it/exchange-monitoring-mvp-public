"use client";

import { ChevronDown, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { currencyDisplayMeta } from "@/components/currency-icon";
import { CustomScrollbar } from "@/components/custom-scrollbar";

export type AssetOption = {
  code: string;
  name: string;
  kind: string;
  networks: { code: string }[];
};

const favoritesStorageKey = "ratescope:favorites";
const popularExactPriority = [
  "BTC",
  "ETH",
  "LTC",
  "XMR",
  "USDTTRC20",
  "USDTERC20",
  "USDTBEP20",
  "USDTTON",
  "USDCERC20",
  "DASH",
  "TON",
  "DOGE",
  "TRX",
  "BCH",
  "BNBBEP20",
  "BNB",
  "ETC",
  "SOL",
  "XRP"
];
const basePriority = ["BTC", "ETH", "LTC", "XMR", "USDT", "DASH", "TON", "DOGE", "TRX", "BCH", "BNB", "ETC", "SOL", "XRP", "USDC", "ADA", "AAVE"];
const networkPriority = ["TRC20", "BEP20", "ERC20", "TON", "Solana", "Polygon", "Arbitrum", "Avalanche", "NEAR Protocol", "Optimism", "Omni"];
const fiatPriority = ["RUB", "USD", "EUR", "UAH", "KZT", "TRY", "CNY", "GBP"];
const collapsedBankPriority = ["сбер", "sber", "т-банк", "тинькофф", "t-bank", "tinkoff", "альфа", "alfa", "втб", "vtb", "райффайзен", "raiffeisen"];
const collapsedPaymentPriority = ["perfect money", "payeer", "paypal", "payoneer", "paxum", "юмoney", "yoomoney", "qiwi"];
const collapsedExchangePriority = ["binance", "bybit", "okx", "htx", "huobi", "coinbase", "kraken"];

type AssetCategoryKey = "crypto" | "exchange" | "bank" | "fiat" | "cash" | "payment" | "transfer" | "other";

export type AssetDisplayGroup = {
  key: AssetCategoryKey | "selected" | "search";
  label: string;
  assets: AssetOption[];
};

const categoryLabels: Record<AssetCategoryKey, string> = {
  crypto: "Криптовалюта",
  exchange: "Балансы криптобирж",
  bank: "Интернет-банкинг",
  fiat: "Фиатные валюты",
  cash: "Наличные деньги",
  payment: "Электронные деньги",
  transfer: "Денежные переводы",
  other: "Другое"
};

const groupedCategoryOrder: AssetCategoryKey[] = ["crypto", "bank", "cash", "payment", "exchange", "transfer", "fiat", "other"];

function readFavorites() {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(favoritesStorageKey);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function displayName(asset: AssetOption) {
  const meta = currencyDisplayMeta(asset.code, asset.name);
  const names: Record<string, string> = {
    RUB: "Российский рубль"
  };

  if (names[meta.displayCode]) return names[meta.displayCode];
  return asset.name;
}

function cleanAssetName(asset: AssetOption) {
  const meta = currencyDisplayMeta(asset.code, asset.name);
  const unit = displayUnit(asset);
  
  if (asset.kind === "CRYPTO") {
    return asset.name.replace(/\((?:[^)]*)\)/g, "").trim();
  }

  const raw = displayName(asset)
    .replace(/\((?:[^)]*)\)/g, "")
    .replace(new RegExp(`\\b${unit}\\b`, "gi"), "")
    .replace(/\b(?:TRC20|ERC20|BEP20|TON|Solana|Polygon|Arbitrum|Avalanche|Optimism|Omni)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeSearchValue(`${asset.code} ${asset.name}`);

  if (normalized.includes("sber") || normalized.includes("сбер")) return "СБЕР";
  if (normalized.includes("alfa") || normalized.includes("альфа")) return "Альфа-Банк";
  if (normalized.includes("raiffeisen") || normalized.includes("райфф")) return "Райффайзен";
  if (normalized.includes("t-bank") || normalized.includes("tinkoff") || normalized.includes("тинькофф")) return "Т-Банк";
  if (normalized.includes("vtb") || normalized.includes("втб")) return "ВТБ";
  if (normalized.includes("yoomoney") || normalized.includes("юмoney") || normalized.includes("юmoney")) return "ЮMoney";
  if (normalized.includes("cash") || normalized.includes("налич")) return "Наличные";
  if (normalized.includes("western union") || normalized === "wu") return "WU";
  if (normalized.includes("korona") || normalized.includes("золотая корона")) return "ЗК";

  return raw || meta.displayCode;
}

function displayUnit(asset: AssetOption) {
  const meta = currencyDisplayMeta(asset.code, asset.name);
  const text = `${asset.code} ${asset.name}`;
  const matched = text.match(/\b(USD|RUB|EUR|UAH|KZT|TRY|CNY|GBP|USDT|USDC|BTC|ETH)\b/i);
  return (matched?.[1] ?? meta.displayCode).toUpperCase();
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function assetSearchText(asset: AssetOption) {
  const meta = currencyDisplayMeta(asset.code, asset.name);
  const network = meta.network ?? asset.networks[0]?.code ?? "";
  
  const russianSynonyms: Record<string, string> = {
    BTC: "биткоин биткоинт bitcoin",
    ETH: "эфириум эфир ethereum",
    LTC: "лайткоин litecoin",
    XMR: "монеро monero",
    USDT: "тезер тесер юсдт стейблкоин tether",
    USDC: "юсдс usdc",
    SOL: "солана solana",
    TON: "тон тонкоин toncoin",
    DOGE: "догикоин доги dogecoin",
    TRX: "трон tron",
    XRP: "рипл риппл ripple",
    BNB: "бнб bnb"
  };
  const synonym = russianSynonyms[meta.displayCode] ?? "";

  return [
    asset.code,
    asset.name,
    asset.kind,
    meta.displayCode,
    network,
    displayName(asset),
    synonym,
    ...asset.networks.map((item) => item.code)
  ].join(" ");
}

export function filterAssets(assets: AssetOption[], query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return assets;

  return assets.filter((asset) => {
    return normalizeSearchValue(assetSearchText(asset)).includes(normalizedQuery);
  });
}

function firstKeywordIndex(value: string, keywords: string[]) {
  const normalized = normalizeSearchValue(value);
  const index = keywords.findIndex((keyword) => normalized.includes(keyword));
  return index === -1 ? 999 : index;
}

function exactPriority(code: string) {
  const index = popularExactPriority.indexOf(code);
  return index === -1 ? 999 : index;
}

function fiatScore(code: string) {
  const index = fiatPriority.indexOf(code);
  return index === -1 ? 999 : index;
}

function baseScore(baseCode: string) {
  const index = basePriority.indexOf(baseCode);
  return index === -1 ? 999 : index;
}

function networkScore(network: string | undefined) {
  const index = networkPriority.indexOf(network ?? "");
  return index === -1 ? 999 : index;
}

function classifyAsset(asset: AssetOption): AssetCategoryKey {
  const text = assetSearchText(asset);
  const normalized = normalizeSearchValue(text);
  const meta = currencyDisplayMeta(asset.code, asset.name);

  if (asset.kind === "CASH" || normalized.includes("налич") || normalized.includes("cash")) return "cash";
  if (asset.kind === "CRYPTO") return "crypto";
  if (firstKeywordIndex(text, collapsedBankPriority) < 999 || normalized.includes("банк") || normalized.includes("bank")) return "bank";
  if (firstKeywordIndex(text, collapsedExchangePriority) < 999 && (normalized.includes("бирж") || normalized.includes("balance") || normalized.includes("баланс"))) return "exchange";
  if (normalized.includes("western union") || normalized.includes("money transfer") || normalized.includes("денеж") || normalized.includes("золотая корона")) return "transfer";
  if (asset.code === meta.displayCode && fiatScore(meta.displayCode) < 999) return "fiat";
  if (
    firstKeywordIndex(text, collapsedPaymentPriority) < 999 ||
    normalized.includes("volet") ||
    normalized.includes("advc") ||
    normalized.includes("skrill") ||
    normalized.includes("neteller") ||
    normalized.includes("webmoney")
  ) {
    return "payment";
  }

  return asset.kind === "FIAT" ? "payment" : "other";
}

function collapsedCategoryRank(asset: AssetOption, category: AssetCategoryKey) {
  const text = assetSearchText(asset);
  const normalized = normalizeSearchValue(text);
  const meta = currencyDisplayMeta(asset.code, asset.name);

  if (category === "crypto") {
    const exact = exactPriority(asset.code);
    if (exact < 999) return exact * 10;

    const base = baseScore(meta.displayCode);
    if (base < 999) return base * 10 + networkScore(meta.network ?? asset.networks[0]?.code) + 1;

    return 999;
  }
  if (category === "bank") return firstKeywordIndex(text, collapsedBankPriority);
  if (category === "payment") return firstKeywordIndex(text, collapsedPaymentPriority);
  if (category === "exchange") return firstKeywordIndex(text, collapsedExchangePriority);
  if (category === "transfer") return normalized.includes("western union") || normalized.includes("денеж") || normalized.includes("золотая корона") ? 0 : 999;
  if (category === "fiat") return fiatScore(meta.displayCode);
  if (category === "cash") return asset.kind === "CASH" || normalized.includes("cash") || normalized.includes("налич") ? 0 : 999;
  return 999;
}

function compareAssetsWithinCategory(left: AssetOption, right: AssetOption) {
  const leftMeta = currencyDisplayMeta(left.code, left.name);
  const rightMeta = currencyDisplayMeta(right.code, right.name);
  const leftExactScore = exactPriority(left.code);
  const rightExactScore = exactPriority(right.code);
  if (leftExactScore !== rightExactScore) return leftExactScore - rightExactScore;

  const leftBaseScore = baseScore(leftMeta.displayCode);
  const rightBaseScore = baseScore(rightMeta.displayCode);
  if (leftBaseScore !== rightBaseScore) return leftBaseScore - rightBaseScore;

  const leftFiatScore = fiatScore(leftMeta.displayCode);
  const rightFiatScore = fiatScore(rightMeta.displayCode);
  if (leftFiatScore !== rightFiatScore) return leftFiatScore - rightFiatScore;

  const leftNetworkScore = networkScore(leftMeta.network ?? left.networks[0]?.code);
  const rightNetworkScore = networkScore(rightMeta.network ?? right.networks[0]?.code);
  if (leftNetworkScore !== rightNetworkScore) return leftNetworkScore - rightNetworkScore;

  return left.code.localeCompare(right.code);
}

export function sortAssets(assets: AssetOption[]) {
  return [...assets].sort((left, right) => {
    const leftCategory = classifyAsset(left);
    const rightCategory = classifyAsset(right);
    const leftCategoryScore = groupedCategoryOrder.indexOf(leftCategory);
    const rightCategoryScore = groupedCategoryOrder.indexOf(rightCategory);
    if (leftCategoryScore !== rightCategoryScore) return leftCategoryScore - rightCategoryScore;

    return compareAssetsWithinCategory(left, right);
  });
}

export function groupAssetsForDisplay(
  assets: AssetOption[],
  {
    query = "",
    expanded = false,
    selectedCode
  }: {
    query?: string;
    expanded?: boolean;
    selectedCode?: string;
  } = {}
) {
  const hasQuery = normalizeSearchValue(query).length > 0;
  const filteredAssets = sortAssets(filterAssets(assets, query));
  const groupsByCategory = new Map<AssetCategoryKey, AssetOption[]>();

  for (const asset of filteredAssets) {
    const category = classifyAsset(asset);
    groupsByCategory.set(category, [...(groupsByCategory.get(category) ?? []), asset]);
  }

  const groups: AssetDisplayGroup[] = [];
  const visibleCodes = new Set<string>();

  for (const category of groupedCategoryOrder) {
    const categoryAssets = groupsByCategory.get(category) ?? [];
    const visibleAssets = hasQuery || expanded
      ? categoryAssets
      : categoryAssets
        .filter((asset) => collapsedCategoryRank(asset, category) < 999)
        .sort((left, right) => collapsedCategoryRank(left, category) - collapsedCategoryRank(right, category));

    if (!visibleAssets.length) continue;

    visibleAssets.forEach((asset) => visibleCodes.add(asset.code));
    groups.push({
      key: hasQuery ? "search" : category,
      label: hasQuery ? "Найдено" : categoryLabels[category],
      assets: visibleAssets
    });
  }

  if (!hasQuery && selectedCode && !visibleCodes.has(selectedCode)) {
    const selectedAsset = assets.find((asset) => asset.code === selectedCode);
    if (selectedAsset) {
      visibleCodes.add(selectedAsset.code);
      groups.unshift({
        key: "selected",
        label: "Выбрано",
        assets: [selectedAsset]
      });
    }
  }

  return {
    groups,
    hiddenCount: hasQuery ? 0 : Math.max(0, sortAssets(assets).length - visibleCodes.size)
  };
}



function AssetList({
  groups,
  selected,
  onSelect,
  emptyText
}: {
  groups: AssetDisplayGroup[];
  selected: string;
  onSelect: (code: string) => void;
  emptyText: string;
}) {
  const hasAssets = groups.some((group) => group.assets.length > 0);

  return (
    <div className="assetList">
      {groups.map((group, groupIndex) => (
        <section className="assetGroup" key={`${group.key}-${group.label}-${groupIndex}`}>
          <h3>{group.label}</h3>
          {group.assets.map((asset) => {
            return (
              <button
                aria-pressed={selected === asset.code}
                className={`assetItem ${selected === asset.code ? "selected" : ""}`}
                data-currency-code={asset.code}
                key={asset.code}
                onClick={() => onSelect(asset.code)}
                type="button"
              >
                <strong>{cleanAssetName(asset)}</strong>
                <small>{displayUnit(asset)}</small>
              </button>
            );
          })}
        </section>
      ))}
      {!hasAssets && <p className="assetEmpty">{emptyText}</p>}
    </div>
  );
}

function CurrencyColumnSearch({
  label,
  query,
  onQuery
}: {
  label: string;
  query: string;
  onQuery: (value: string) => void;
}) {
  return (
    <label className="sideColumnTitle">
      <span>{label}</span>
      <div className="sideColumnSearch">
        <input
          aria-label={`Поиск валюты: ${label.toLocaleLowerCase("ru-RU")}`}
          autoComplete="off"
          inputMode="search"
          onChange={(event) => onQuery(event.target.value)}
          placeholder={label}
          spellCheck={false}
          type="search"
          value={query}
        />
        <Search aria-hidden="true" size={11} />
      </div>
    </label>
  );
}

export function CurrencySidebar({
  assets,
  from,
  to,
  onFrom,
  onTo
}: {
  assets: AssetOption[];
  from: string;
  to: string;
  onFrom: (code: string) => void;
  onTo: (code: string) => void;
  onSwap: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);

  useEffect(() => {
    const syncFavorites = () => setFavorites(readFavorites());
    const timer = window.setTimeout(syncFavorites, 0);
    window.addEventListener("storage", syncFavorites);
    window.addEventListener("ratescope:favorites-changed", syncFavorites);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncFavorites);
      window.removeEventListener("ratescope:favorites-changed", syncFavorites);
    };
  }, []);

  const favoritePairs = useMemo(
    () =>
      favorites
        .map((pair) => {
          const [favoriteFrom, favoriteTo] = pair.split(":");
          return favoriteFrom && favoriteTo ? { from: favoriteFrom, to: favoriteTo } : null;
        })
        .filter((pair): pair is { from: string; to: string } => Boolean(pair)),
    [favorites]
  );

  const sortedAssets = useMemo(() => sortAssets(assets), [assets]);
  const fromDisplay = useMemo(
    () => groupAssetsForDisplay(sortedAssets, { query: fromQuery, expanded: showAllCurrencies, selectedCode: from }),
    [from, fromQuery, showAllCurrencies, sortedAssets]
  );
  const toDisplay = useMemo(
    () => groupAssetsForDisplay(sortedAssets, { query: toQuery, expanded: showAllCurrencies, selectedCode: to }),
    [showAllCurrencies, sortedAssets, to, toQuery]
  );
  const collapsedHiddenCurrencyCount = useMemo(() => {
    const collapsedFrom = groupAssetsForDisplay(sortedAssets, { selectedCode: from });
    const collapsedTo = groupAssetsForDisplay(sortedAssets, { selectedCode: to });
    return Math.max(collapsedFrom.hiddenCount, collapsedTo.hiddenCount);
  }, [from, sortedAssets, to]);
  return (
    <aside className="currencySidebar">
      <div className="sideTabs">
        <button className={activeTab === "all" ? "active" : undefined} type="button" onClick={() => setActiveTab("all")}>
          Все валюты
        </button>
        <button className={activeTab === "favorites" ? "active" : undefined} type="button" onClick={() => setActiveTab("favorites")}>
          Избранное
        </button>
      </div>
      {activeTab === "favorites" ? (
        <CustomScrollbar className="favoritePairsWrapper">
          <div className="favoritePairs">
            {favoritePairs.map((pair) => (
              <button
                className={from === pair.from && to === pair.to ? "selected" : undefined}
                key={`${pair.from}:${pair.to}`}
                type="button"
                onClick={() => {
                  onFrom(pair.from);
                  onTo(pair.to);
                }}
              >
                <Star size={15} fill="currentColor" />
                <span><strong>{pair.from} → {pair.to}</strong><small>Открыть направление</small></span>
              </button>
            ))}
            {!favoritePairs.length && (
              <p className="assetEmpty">Избранные направления отсутствуют</p>
            )}
          </div>
        </CustomScrollbar>
      ) : (
        <>
          <p className="assetCategory">Направления обмена</p>
          <CustomScrollbar className="sideColumnsWrapper">
            <div className="sideColumnsContent">
              <div className="sideColumns">
                <section className="sideColumn" aria-label="Отдаете">
                  <CurrencyColumnSearch label="Отдаёте" query={fromQuery} onQuery={setFromQuery} />
                  <AssetList groups={fromDisplay.groups} selected={from} onSelect={onFrom} emptyText="Валюты не найдены" />
                </section>
                <section className="sideColumn" aria-label="Получаете">
                  <CurrencyColumnSearch label="Получаете" query={toQuery} onQuery={setToQuery} />
                  <AssetList groups={toDisplay.groups} selected={to} onSelect={onTo} emptyText="Валюты не найдены" />
                </section>
              </div>
              {!fromQuery && !toQuery && collapsedHiddenCurrencyCount > 0 && (
                <button className="showAllCurrencies" type="button" onClick={() => setShowAllCurrencies((value) => !value)}>
                  {showAllCurrencies ? "Скрыть редкие валюты" : `Показать все ${collapsedHiddenCurrencyCount}`}
                  <ChevronDown aria-hidden="true" size={13} className={showAllCurrencies ? "expanded" : undefined} />
                </button>
              )}
            </div>
          </CustomScrollbar>
        </>
      )}
    </aside>
  );
}
