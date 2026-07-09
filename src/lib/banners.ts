import { PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type BannerPlacement =
  | "site-top"
  | "monitor-top"
  | "catalog-top"
  | "dashboard-top";

export type BannerConfig = {
  placement: BannerPlacement;
  title: string;
  text: string;
  href: string;
  image?: string;
  alt: string;
  badge: string;
  enabled: boolean;
};

const placementEnvKey: Record<BannerPlacement, string> = {
  "site-top": "SITE_TOP",
  "monitor-top": "MONITOR_TOP",
  "catalog-top": "CATALOG_TOP",
  "dashboard-top": "DASHBOARD_TOP"
};

const defaultBanners: Record<BannerPlacement, Omit<BannerConfig, "placement" | "enabled">> = {
  "site-top": {
    badge: "Реклама",
    title: "Разместите баннер на monik exchange",
    text: "Покажите обменник аудитории, которая уже сравнивает курсы и выбирает направление.",
    href: "/contacts#feedback",
    alt: "Баннер monik exchange"
  },
  "monitor-top": {
    badge: "Партнерский слот",
    title: "Премиум-размещение в мониторинге",
    text: "Баннер виден рядом с выбором направления и таблицей предложений.",
    href: "/contacts#feedback",
    alt: "Баннер в мониторинге"
  },
  "catalog-top": {
    badge: "Каталог",
    title: "Баннер в каталоге обменников",
    text: "Подходит для акций, новых направлений и брендовых объявлений.",
    href: "/contacts#feedback",
    alt: "Баннер в каталоге"
  },
  "dashboard-top": {
    badge: "Для партнеров",
    title: "Управление рекламными местами",
    text: "Слоты готовы к подключению платных баннеров через переменные окружения.",
    href: "/contacts#feedback",
    alt: "Партнерский баннер"
  }
};

export const bannerPlacements = Object.keys(placementEnvKey) as BannerPlacement[];

function env(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function envEnabled(name: string, fallback: boolean) {
  const value = env(name);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function publicText(value: string | null | undefined) {
  return value ? value.replace(/RateScope/g, "monik exchange") : value;
}

function envBanner(placement: BannerPlacement): BannerConfig | null {
  const key = placementEnvKey[placement];
  const defaults = defaultBanners[placement];
  const title = env(`RATESCOPE_BANNER_${key}_TITLE`) ?? defaults.title;
  const text = env(`RATESCOPE_BANNER_${key}_TEXT`) ?? defaults.text;
  const href = env(`RATESCOPE_BANNER_${key}_HREF`) ?? defaults.href;
  const image = env(`RATESCOPE_BANNER_${key}_IMAGE`);
  const badge = env(`RATESCOPE_BANNER_${key}_BADGE`) ?? defaults.badge;
  const alt = env(`RATESCOPE_BANNER_${key}_ALT`) ?? title ?? defaults.alt;
  const configured = Boolean(
    env(`RATESCOPE_BANNER_${key}_TITLE`) ||
    env(`RATESCOPE_BANNER_${key}_TEXT`) ||
    env(`RATESCOPE_BANNER_${key}_HREF`) ||
    env(`RATESCOPE_BANNER_${key}_IMAGE`)
  );
  const enabled = envEnabled(`RATESCOPE_BANNER_${key}_ENABLED`, placement === "site-top" || configured);

  if (!enabled) return null;

  return {
    placement,
    title: publicText(title) ?? title,
    text: publicText(text) ?? text,
    href,
    image,
    alt: publicText(alt) ?? alt,
    badge: publicText(badge) ?? badge,
    enabled
  };
}

export async function getBanner(placement: BannerPlacement): Promise<BannerConfig | null> {
  try {
    const stored = await prisma.banner.findUnique({ where: { placement } });
    if (stored) {
      if (stored.status !== PublishStatus.PUBLISHED) return null;
      return {
        placement,
        title: publicText(stored.title) ?? stored.title,
        text: publicText(stored.text) ?? stored.text,
        href: stored.href,
        image: stored.image ?? undefined,
        alt: publicText(stored.alt) ?? stored.alt,
        badge: publicText(stored.badge) ?? stored.badge,
        enabled: true
      };
    }
  } catch {}

  return envBanner(placement);
}

export function getBannerSlotDocs() {
  return bannerPlacements.map((placement) => {
    const key = placementEnvKey[placement];
    return {
      placement,
      key,
      title: defaultBanners[placement].title,
      defaults: defaultBanners[placement],
      variables: [
        `RATESCOPE_BANNER_${key}_ENABLED`,
        `RATESCOPE_BANNER_${key}_TITLE`,
        `RATESCOPE_BANNER_${key}_TEXT`,
        `RATESCOPE_BANNER_${key}_HREF`,
        `RATESCOPE_BANNER_${key}_IMAGE`,
        `RATESCOPE_BANNER_${key}_BADGE`,
        `RATESCOPE_BANNER_${key}_ALT`
      ]
    };
  });
}
