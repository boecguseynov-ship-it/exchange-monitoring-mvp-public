export type DirectionAsset = {
  code: string;
  name: string;
  kind: string;
  networks: { code: string }[];
};

const preferredSlugsByCode: Record<string, string> = {
  ACRUB: "alfabank",
  BTC: "bitcoin",
  ETH: "ethereum",
  LTC: "litecoin",
  RUB: "russian-ruble",
  SBERRUB: "sberbank",
  TBRUB: "vtb",
  TCSBRUB: "tbank",
  USDTBEP20: "usdt-bep20",
  USDTERC20: "usdt-erc20",
  USDTPOLYGON: "usdt-polygon",
  USDTTRC20: "usdt-trc20",
  YAMRUB: "yoomoney"
};

const extraSlugsByCode: Record<string, string[]> = {
  ACRUB: ["alfa-bank", "alfabank-rub"],
  BTC: ["btc"],
  RUB: ["rub", "ruble", "rub-russian"],
  SBERRUB: ["sber", "sber-rub", "sberbank-rub"],
  TBRUB: ["vtb-rub"],
  TCSBRUB: ["tinkoff", "tinkoff-rub", "t-bank", "tbank-rub"],
  USDTERC20: ["usdterc20"],
  USDTPOLYGON: ["usdtpolygon"],
  USDTTRC20: ["usdttrc20"],
  YAMRUB: ["yamrub", "yoo-money", "yoomoney-rub"]
};

function normalizeRoutePart(value: string) {
  return decodeURIComponent(value)
    .replace(/\.html$/i, "")
    .trim()
    .toLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assetDirectionSlug(code: string, assets: DirectionAsset[] = []) {
  const normalizedCode = code.trim().toUpperCase();
  const asset = assets.find((item) => item.code.toUpperCase() === normalizedCode);
  return preferredSlugsByCode[normalizedCode] ?? (asset ? slugify(asset.name) : normalizedCode.toLowerCase());
}

export function buildDirectionPath(fromCode: string, toCode: string, assets: DirectionAsset[] = []) {
  return `/${assetDirectionSlug(fromCode, assets)}-to-${assetDirectionSlug(toCode, assets)}`;
}

function assetSlugCandidates(asset: DirectionAsset) {
  const code = asset.code.trim().toUpperCase();
  return new Set([
    code.toLowerCase(),
    preferredSlugsByCode[code],
    slugify(asset.name),
    ...asset.networks.map((network) => slugify(`${asset.name} ${network.code}`)),
    ...(extraSlugsByCode[code] ?? [])
  ].filter(Boolean));
}

export function findAssetByDirectionSlug(slug: string, assets: DirectionAsset[]) {
  const normalizedSlug = normalizeRoutePart(slug);
  return assets.find((asset) => assetSlugCandidates(asset).has(normalizedSlug)) ?? null;
}

export function parseDirectionSlug(direction: string, assets: DirectionAsset[]) {
  const normalizedDirection = direction.replace(/^\/+|\/+$/g, "");
  const [fromSlug, toSlug, ...rest] = normalizedDirection.split("-to-");
  if (!fromSlug || !toSlug || rest.length) return null;

  const from = findAssetByDirectionSlug(fromSlug, assets);
  const to = findAssetByDirectionSlug(toSlug, assets);
  if (!from || !to) return null;

  return { from: from.code, to: to.code };
}
