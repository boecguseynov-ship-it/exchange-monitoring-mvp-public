type CurrencyIconProps = {
  code: string;
  name?: string;
  size?: number;
  className?: string;
};

const networkSuffixes = {
  ARBITRUM: "Arbitrum",
  OPTIMISM: "Optimism",
  AVALANCHE: "Avalanche",
  POLYGON: "Polygon",
  AVAXC: "Avalanche",
  TRC20: "TRC-20",
  ERC20: "ERC-20",
  BEP20: "BEP-20",
  BEP2: "BEP2",
  NEAR: "NEAR Protocol",
  OMNI: "Omni",
  TON: "TON",
  SOL: "Solana",
  BTC: "Bitcoin",
  LN: "Lightning"
} as const;

const aliases: Record<string, string> = {
  XBT: "BTC",
  WBTC: "BTC",
  USDTBEP: "USDT",
  USDTBEP20: "USDT",
  USDTTRC: "USDT",
  USDTTRC20: "USDT",
  USDTERC: "USDT",
  USDTERC20: "USDT",
  USDTAVAXC: "USDT",
  USDCBEP: "USDC",
  USDCBEP20: "USDC",
  USDCTRC: "USDC",
  USDCTRC20: "USDC",
  USDCERC: "USDC",
  USDCERC20: "USDC",
  USDCAVAXC: "USDC"
};

const networkOverrides: Record<string, string> = {
  USDTBEP: "BEP-20",
  USDTTRC: "TRC-20",
  USDTERC: "ERC-20",
  USDCBEP: "BEP-20",
  USDCTRC: "TRC-20",
  USDCERC: "ERC-20"
};

const icons: Record<string, { symbol: string; bg: string; fg?: string; ring?: string; variant?: "usdt" | "usdc" | "eth" }> = {
  BTC: { symbol: "₿", bg: "#f7931a" },
  ETH: { symbol: "Ξ", bg: "#627eea", variant: "eth" },
  USDT: { symbol: "₮", bg: "#18b7ad", variant: "usdt" },
  USDC: { symbol: "$", bg: "#2775ca", variant: "usdc" },
  USD: { symbol: "$", bg: "#2f80ed" },
  RUB: { symbol: "₽", bg: "#3978d6" },
  EUR: { symbol: "€", bg: "#3451aa" },
  AAVE: { symbol: "A", bg: "#b6509e" },
  ADA: { symbol: "A", bg: "#0033ad" },
  ADV: { symbol: "AD", bg: "#bb5c3b" },
  SOL: { symbol: "S", bg: "#151515", ring: "#14f195" },
  BNB: { symbol: "B", bg: "#f3ba2f", fg: "#1f1a05" },
  TRX: { symbol: "T", bg: "#ef0027" },
  LTC: { symbol: "Ł", bg: "#345d9d" },
  XRP: { symbol: "X", bg: "#20252d" },
  DOGE: { symbol: "Ð", bg: "#c2a633" },
  TON: { symbol: "T", bg: "#0098ea" },
  AVAX: { symbol: "A", bg: "#e84142" },
  MATIC: { symbol: "M", bg: "#8247e5" },
  POL: { symbol: "P", bg: "#8247e5" },
  DOT: { symbol: "●", bg: "#e6007a" },
  BCH: { symbol: "B", bg: "#8dc351" },
  XMR: { symbol: "M", bg: "#ff6600" },
  DASH: { symbol: "D", bg: "#008de4" },
  UAH: { symbol: "₴", bg: "#2b74d6" },
  KZT: { symbol: "₸", bg: "#1f9a8a" },
  TRY: { symbol: "₺", bg: "#d34f45" },
  GBP: { symbol: "£", bg: "#4a5fa8" },
  CNY: { symbol: "¥", bg: "#d84848" }
};

function normalizeCode(code: string) {
  return code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function currencyDisplayMeta(code: string, name?: string) {
  const normalized = normalizeCode(code);
  const direct = aliases[normalized] ?? normalized;
  const suffix = Object.keys(networkSuffixes)
    .filter((item) => normalized.endsWith(item))
    .sort((left, right) => right.length - left.length)[0] as keyof typeof networkSuffixes | undefined;
  const stripped = suffix ? normalized.slice(0, -suffix.length) : direct;
  const fromParentheses = name?.match(/\(([A-Z0-9]{2,12})\)/)?.[1];
  const base = aliases[direct] ?? aliases[stripped] ?? (icons[stripped] ? stripped : fromParentheses ?? stripped);
  const displayCode = base.length > 6 ? base.slice(0, 6) : base;
  const network = networkOverrides[normalized] ?? (suffix ? networkSuffixes[suffix] : undefined);

  return {
    baseCode: icons[base] ? base : displayCode,
    displayCode,
    network
  };
}

function fallbackColor(code: string) {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash} 62% 42%)`;
}

export function CurrencyIcon({ code, name, size = 29, className }: CurrencyIconProps) {
  const { baseCode, displayCode } = currencyDisplayMeta(code, name);
  const icon = icons[baseCode] ?? {
    symbol: displayCode.slice(0, 1),
    bg: fallbackColor(baseCode)
  };
  const label = name ? `${name} (${code})` : code;

  return (
    <span className={`currencyIcon ${className ?? ""}`} style={{ width: size, height: size }} title={label}>
      <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="15" fill={icon.bg} />
        <circle cx="16" cy="16" r="13" fill="none" stroke={icon.ring ?? "rgba(255,255,255,.25)"} strokeWidth="2" />
        {icon.variant === "usdt" && (
          <>
            <path d="M8 9h16v4h-6v2.1c3.7.2 6.3.9 6.3 1.8s-2.6 1.6-6.3 1.8V23h-4v-4.3c-3.7-.2-6.3-.9-6.3-1.8s2.6-1.6 6.3-1.8V13H8V9Z" fill="#fff" />
            <path d="M10.8 16.9c1 .4 2.8.6 5.2.6s4.2-.2 5.2-.6c-1-.4-2.8-.6-5.2-.6s-4.2.2-5.2.6Z" fill={icon.bg} />
          </>
        )}
        {icon.variant === "usdc" && (
          <>
            <path d="M11.5 9.4a7.4 7.4 0 0 0 0 13.2M20.5 9.4a7.4 7.4 0 0 1 0 13.2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M16 8.7v14.6M19 12.2c-.8-.7-1.8-1-3-1-1.8 0-3 .9-3 2.3 0 3.3 6.2 1.6 6.2 4.9 0 1.4-1.2 2.4-3.2 2.4-1.4 0-2.6-.4-3.6-1.3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {icon.variant === "eth" && (
          <>
            <path d="M16 5.4 9.3 16 16 19.8 22.7 16 16 5.4Z" fill="#fff" opacity=".95" />
            <path d="M9.3 17.3 16 26.6l6.7-9.3-6.7 3.8-6.7-3.8Z" fill="#fff" opacity=".72" />
            <path d="M16 5.4v14.4l6.7-3.8L16 5.4Z" fill="#dce5ff" opacity=".75" />
          </>
        )}
        {!icon.variant && (
          <text
            x="16"
            y="17.4"
            dominantBaseline="middle"
            textAnchor="middle"
            fill={icon.fg ?? "#fff"}
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={icon.symbol.length > 1 ? "10" : "16"}
            fontWeight="800"
          >
            {icon.symbol}
          </text>
        )}
      </svg>
    </span>
  );
}
