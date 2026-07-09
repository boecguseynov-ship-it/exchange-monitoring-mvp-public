import {
  ApiCredentialStatus,
  ComplaintStatus,
  ExchangeStatus,
  ModerationStatus,
  PublishStatus,
  SupportStatus,
  type AuditLog,
  type Banner,
  type BlogPost,
  type ContactMessage,
  type DirectionSeoText,
  type LegalDocument,
  type ManagedAsset,
  type Prisma,
  type WikiEntry
} from "@prisma/client";
import { blogArticles, wikiGroups } from "@/features/public-content/content";
import { loadLiveExchangeDirectory } from "@/lib/bestchange/service";
import { getBannerSlotDocs } from "@/lib/banners";
import { prisma } from "@/lib/db/prisma";
import { defaultContactSocialLinks, contactSocialLinkGroup } from "@/lib/site-links";
import { legalPages } from "@/lib/legal-pages";

export type AdminSection =
  | "moderation"
  | "exchanges"
  | "assets"
  | "content"
  | "links"
  | "support"
  | "audit"
  | "users";

export const adminSections: Array<{ key: AdminSection; label: string }> = [
  { key: "moderation", label: "Модерация" },
  { key: "exchanges", label: "Обменники" },
  { key: "assets", label: "Валюты и API" },
  { key: "content", label: "Контент" },
  { key: "links", label: "Ссылки" },
  { key: "support", label: "Обращения" },
  { key: "audit", label: "Аудит" },
  { key: "users", label: "Пользователи" }
];

const exchangePageSize = 30;

type ReviewWithExchange = Prisma.ReviewGetPayload<{ include: { exchange: true } }>;
type ExchangeAdminRecord = Prisma.ExchangeGetPayload<{
  include: {
    feeds: true;
    apiKeys: true;
    _count: { select: { reviews: true; complaints: true } };
  };
}>;
type ComplaintWithExchange = Prisma.ComplaintGetPayload<{ include: { exchange: true } }>;

export type AdminConsoleOptions = {
  exchangePage?: number;
  exchangeQuery?: string;
};

function normalizeExchangePage(value?: number) {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 1;
}

function normalizeExchangeQuery(value?: string) {
  return (value ?? "").trim().slice(0, 80);
}

export function parseAdminSection(value: string | string[] | undefined): AdminSection {
  const section = Array.isArray(value) ? value[0] : value;
  return adminSections.some((item) => item.key === section) ? section as AdminSection : "moderation";
}

export function statusLabel(value: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Активен",
    PAUSED: "Приостановлен",
    HIDDEN: "Скрыт",
    PENDING: "На проверке",
    PUBLISHED: "Опубликовано",
    REJECTED: "Отклонено",
    DRAFT: "Черновик",
    NEW: "Новое",
    IN_PROGRESS: "В работе",
    RESOLVED: "Решено",
    SPAM: "Спам",
    OPEN: "Открыта",
    WAITING_EXCHANGE: "Ждем обменник",
    WAITING_USER: "Ждем пользователя",
    REVOKED: "Отозван"
  };
  return labels[value] ?? value;
}

export function formatAdminDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

async function audit(action: string, targetType: string, targetId?: string, details?: string) {
  await prisma.auditLog.create({
    data: { action, targetType, targetId, details, actor: "admin@ratescope.local" }
  }).catch(() => null);
}

function fallbackExchangeDomain(slug: string) {
  return `live-${slug.toLowerCase().replace(/[^a-z0-9._+-]+/g, "-") || "exchange"}.ratescope.local`;
}

const exchangeActiveLabel = "\u0410\u043a\u0442\u0438\u0432\u0435\u043d";
const exchangeDisabledLabel = "\u041e\u0442\u043a\u043b\u044e\u0447\u0435\u043d";
const exchangeReserveLabel = "\u0440\u0435\u0437\u0435\u0440\u0432";

function exchangeReserveDescription(verified: boolean, reserve: number) {
  return `${verified ? exchangeActiveLabel : exchangeDisabledLabel} \u00b7 ${exchangeReserveLabel} $${reserve.toLocaleString("ru-RU")}`;
}

async function upsertSyncedExchange(exchange: Awaited<ReturnType<typeof loadLiveExchangeDirectory>>[number]) {
  const slug = String(exchange.slug);
  const proposedDomain = exchange.domain && exchange.domain !== "monik.exchange" ? exchange.domain : fallbackExchangeDomain(slug);
  const existing = await prisma.exchange.findUnique({ where: { slug } });
  const domainOwner = await prisma.exchange.findUnique({ where: { domain: proposedDomain } }).catch(() => null);
  const domain = domainOwner && domainOwner.slug !== slug ? fallbackExchangeDomain(slug) : proposedDomain;
  const data = {
    name: exchange.name,
    description: exchangeReserveDescription(exchange.verified, exchange.reserve),
    supportEmail: `support+${slug}@ratescope.local`,
    status: exchange.verified ? ExchangeStatus.ACTIVE : ExchangeStatus.PAUSED,
    isDemo: false,
    verifiedAt: exchange.verified ? new Date() : null
  };

  const saved = existing
    ? await prisma.exchange.update({
      where: { id: existing.id },
      data
    })
    : await prisma.exchange.create({
      data: { slug, domain, ...data }
    });

  await prisma.exchangeFeed.upsert({
    where: { exchangeId: saved.id },
    update: {},
    create: { exchangeId: saved.id, intervalSec: 300, enabled: true }
  });
  return saved;
}

export async function syncAllExchangesFromProvider() {
  const directory = await loadLiveExchangeDirectory();
  let imported = 0;
  for (const exchange of directory) {
    await upsertSyncedExchange(exchange);
    imported += 1;
  }
  await audit("EXCHANGE_DIRECTORY_SYNCED", "PLATFORM", "ratescope", `${imported} обменников`);
  return imported;
}

async function ensureDefaults() {
  const [assetCount, blogCount, legalCount, linkCount, wikiCount, auditCount, exchangeCount, bannerCount] = await Promise.all([
    prisma.managedAsset.count(),
    prisma.blogPost.count(),
    prisma.legalDocument.count(),
    prisma.wikiEntry.count({ where: { group: contactSocialLinkGroup } }),
    prisma.wikiEntry.count({ where: { group: { not: contactSocialLinkGroup } } }),
    prisma.auditLog.count(),
    prisma.exchange.count(),
    prisma.banner.count()
  ]);

  if (exchangeCount < 100) {
    await syncAllExchangesFromProvider().catch((error) => {
      console.error("Exchange directory sync failed", error);
    });
  }

  if (!exchangeCount) {
    const defaults = [
      ["1019", "001K", "001k.exchange", 51591789],
      ["565", "Transfer24", "transfer24.pro", 8079110],
      ["1568", "YellowChanger", "yellowchanger.com", 3046540],
      ["1387", "TheChange", "thechange.ltd", 7024975],
      ["102", "AlwaysMoney", "alwaysmoney.io", 2580000],
      ["488", "Baksman", "baksman.org", 4860000],
      ["497", "ProstoCash", "prostocash.com", 3950000],
      ["721", "Xchange", "xchange.cash", 6240000],
      ["900", "NiceChange", "nicechange.net", 2190000]
    ] as const;
    const exchanges = await Promise.all(defaults.map(([slug, name, domain, reserve]) =>
      prisma.exchange.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          name,
          domain,
          description: exchangeReserveDescription(true, reserve),
          supportEmail: `support+${slug}@ratescope.local`,
          insuranceDeposit: null,
          status: ExchangeStatus.ACTIVE,
          isDemo: true,
          verifiedAt: new Date()
        }
      })
    ));
    await Promise.all(exchanges.map((exchange) =>
      prisma.exchangeFeed.upsert({
        where: { exchangeId: exchange.id },
        update: {},
        create: {
          exchangeId: exchange.id,
          intervalSec: 300,
          enabled: true
        }
      })
    ));
  }

  if (!assetCount) {
    const defaults = [
      { code: "BTC", name: "Bitcoin", network: "BTC", category: "crypto", position: 10 },
      { code: "USDTTRC", name: "Tether USDT", network: "TRC20", category: "crypto", position: 20 },
      { code: "USDTERC", name: "Tether USDT", network: "ERC20", category: "crypto", position: 30 },
      { code: "SBERRUB", name: "Сбербанк RUB", category: "bank", position: 40 },
      { code: "TCSBRUB", name: "Тинькофф RUB", category: "bank", position: 50 },
      { code: "ACRUB", name: "Наличные RUB", category: "cash", position: 60 },
      { code: "CARDUSD", name: "Visa/Mastercard USD", category: "card", position: 70 },
      { code: "CASHUSD", name: "Наличные USD", category: "cash", position: 80 }
    ];
    await Promise.all(defaults.map((asset) =>
      prisma.managedAsset.upsert({
        where: { code: asset.code },
        update: {},
        create: asset
      })
    ));
  }

  if (!blogCount) {
    await Promise.all(blogArticles.map((article, index) =>
      prisma.blogPost.upsert({
        where: { slug: article.id },
        update: {},
        create: {
          slug: article.id,
          title: article.title,
          excerpt: article.excerpt,
          body: [
            article.excerpt,
            "Перед обменом сравните курс, лимиты, резерв, сеть перевода и свежесть обновления.",
            "Если условия выглядят подозрительно выгодными, проверьте домен обменника и историю отзывов.",
            "monik exchange помогает отсеять рискованные варианты, но финальные условия всегда подтверждайте на сайте обменника."
          ].join("\n\n"),
          category: article.category,
          readTime: article.readTime,
          accent: article.accent,
          symbol: article.symbol,
          publishedAt: new Date(Date.now() - index * 86400000)
        }
      })
    ));
  }

  if (!legalCount) {
    await Promise.all(Object.values(legalPages).map((page) =>
      prisma.legalDocument.upsert({
        where: { slug: page.slug },
        update: {},
        create: {
          slug: page.slug,
          title: page.title,
          description: page.description,
          body: page.body
        }
      })
    ));
  }

  if (!linkCount) {
    await prisma.wikiEntry.createMany({
      data: defaultContactSocialLinks.map((link) => ({
        title: link.label,
        description: link.key,
        href: link.href,
        group: contactSocialLinkGroup,
        icon: link.key,
        position: link.position,
        status: link.enabled ? "PUBLISHED" : "HIDDEN"
      }))
    });
  }

  if (!bannerCount) {
    await Promise.all(getBannerSlotDocs().map((slot, index) =>
      prisma.banner.upsert({
        where: { placement: slot.placement },
        update: {},
        create: {
          placement: slot.placement,
          title: slot.defaults.title,
          text: slot.defaults.text,
          href: slot.defaults.href,
          image: null,
          alt: slot.defaults.alt,
          badge: slot.defaults.badge,
          status: slot.placement === "site-top" ? PublishStatus.PUBLISHED : PublishStatus.HIDDEN,
          position: (index + 1) * 10
        }
      })
    ));
  }

  if (!wikiCount) {
    await prisma.wikiEntry.createMany({
      data: wikiGroups.flatMap((group) =>
        group.items.map((item, index) => ({
          title: item.title,
          description: item.description,
          href: item.href,
          anchor: item.anchor,
          group: group.title,
          icon: group.icon,
          position: (index + 1) * 10,
          status: "PUBLISHED"
        }))
      )
    });
  }

  if (!auditCount) {
    await audit("ADMIN_DEFAULTS_CREATED", "PLATFORM", "ratescope", "Стартовые данные админки подготовлены");
  }
}

export async function loadAdminConsole(section: AdminSection = "moderation", options: AdminConsoleOptions = {}) {
  await ensureDefaults();

  const [
    users,
    exchangesCount,
    activeExchanges,
    assetsCount,
    activeComplaints,
    pendingReviewsCount,
    blogPostsCount,
    directionSeoTextsCount,
    legalDocumentsCount,
    wikiEntriesCount,
    contactLinksCount,
    contactMessagesCount,
    complaintsCount,
    auditLogsCount
  ] = await Promise.all([
    prisma.user.count(),
    prisma.exchange.count(),
    prisma.exchange.count({ where: { status: ExchangeStatus.ACTIVE } }),
    prisma.managedAsset.count({ where: { status: PublishStatus.PUBLISHED } }),
    prisma.complaint.count({ where: { status: { in: [ComplaintStatus.OPEN, ComplaintStatus.WAITING_EXCHANGE, ComplaintStatus.WAITING_USER] } } }),
    prisma.review.count({ where: { status: ModerationStatus.PENDING } }),
    prisma.blogPost.count(),
    prisma.directionSeoText.count(),
    prisma.legalDocument.count(),
    prisma.wikiEntry.count({ where: { group: { not: contactSocialLinkGroup } } }),
    prisma.wikiEntry.count({ where: { group: contactSocialLinkGroup } }),
    prisma.contactMessage.count(),
    prisma.complaint.count(),
    prisma.auditLog.count()
  ]);

  let pendingReviews: ReviewWithExchange[] = [];
  let latestReviews: ReviewWithExchange[] = [];
  let exchanges: ExchangeAdminRecord[] = [];
  let assets: ManagedAsset[] = [];
  let blogPosts: BlogPost[] = [];
  let directionSeoTexts: DirectionSeoText[] = [];
  let legalDocuments: LegalDocument[] = [];
  let wikiEntries: WikiEntry[] = [];
  let contactLinks: WikiEntry[] = [];
  let banners: Banner[] = [];
  let contactMessages: ContactMessage[] = [];
  let complaints: ComplaintWithExchange[] = [];
  let auditLogs: AuditLog[] = [];
  let dbUsers: any[] = [];

  const exchangeQuery = normalizeExchangeQuery(options.exchangeQuery);
  let exchangePage = normalizeExchangePage(options.exchangePage);
  let exchangeTotal = exchangesCount;

  if (section === "moderation") {
    [pendingReviews, latestReviews] = await Promise.all([
      prisma.review.findMany({
        where: { status: ModerationStatus.PENDING },
        include: { exchange: true },
        orderBy: { createdAt: "desc" },
        take: 30
      }),
      prisma.review.findMany({
        include: { exchange: true },
        orderBy: { createdAt: "desc" },
        take: 30
      })
    ]);
  }

  if (section === "exchanges") {
    const exchangeWhere: Prisma.ExchangeWhereInput = exchangeQuery
      ? {
          OR: [
            { name: { contains: exchangeQuery } },
            { slug: { contains: exchangeQuery } },
            { domain: { contains: exchangeQuery } }
          ]
        }
      : {};

    exchangeTotal = await prisma.exchange.count({ where: exchangeWhere });
    const exchangePageCount = Math.max(1, Math.ceil(exchangeTotal / exchangePageSize));
    exchangePage = Math.min(exchangePage, exchangePageCount);
    exchanges = await prisma.exchange.findMany({
      where: exchangeWhere,
      include: { feeds: true, apiKeys: { orderBy: { createdAt: "desc" } }, _count: { select: { reviews: true, complaints: true } } },
      orderBy: { name: "asc" },
      skip: (exchangePage - 1) * exchangePageSize,
      take: exchangePageSize
    });
  }

  if (section === "assets") {
    assets = await prisma.managedAsset.findMany({ orderBy: [{ position: "asc" }, { code: "asc" }] });
  }

  if (section === "content") {
    [blogPosts, directionSeoTexts, legalDocuments, wikiEntries] = await Promise.all([
      prisma.blogPost.findMany({ orderBy: [{ publishedAt: "desc" }, { title: "asc" }] }),
      prisma.directionSeoText.findMany({ orderBy: [{ updatedAt: "desc" }, { slug: "asc" }] }),
      prisma.legalDocument.findMany({ orderBy: { slug: "asc" } }),
      prisma.wikiEntry.findMany({
        where: { group: { not: contactSocialLinkGroup } },
        orderBy: [{ group: "asc" }, { position: "asc" }, { title: "asc" }]
      })
    ]);
  }

  if (section === "links") {
    [contactLinks, banners] = await Promise.all([
      prisma.wikiEntry.findMany({
        where: { group: contactSocialLinkGroup },
        orderBy: [{ position: "asc" }, { title: "asc" }]
      }),
      prisma.banner.findMany({ orderBy: [{ position: "asc" }, { placement: "asc" }] })
    ]);
  }

  if (section === "support") {
    [contactMessages, complaints] = await Promise.all([
      prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
      prisma.complaint.findMany({ include: { exchange: true }, orderBy: { createdAt: "desc" }, take: 40 })
    ]);
  }

  if (section === "audit") {
    auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 });
  }

  if (section === "users") {
    [dbUsers, exchanges] = await Promise.all([
      prisma.user.findMany({
        include: { exchange: true },
        orderBy: { email: "asc" }
      }),
      prisma.exchange.findMany({
        where: { status: ExchangeStatus.ACTIVE },
        orderBy: { name: "asc" }
      }) as any
    ]);
  }

  const exchangePageCount = Math.max(1, Math.ceil(exchangeTotal / exchangePageSize));

  return {
    counts: {
      users,
      exchanges: exchangesCount,
      activeExchanges,
      assets: assetsCount,
      activeComplaints,
      pendingReviews: pendingReviewsCount,
      content: blogPostsCount + directionSeoTextsCount + legalDocumentsCount + wikiEntriesCount,
      links: contactLinksCount,
      support: contactMessagesCount + complaintsCount,
      audit: auditLogsCount
    },
    exchangePagination: {
      page: exchangePage,
      pageCount: exchangePageCount,
      pageSize: exchangePageSize,
      query: exchangeQuery,
      total: exchangeTotal
    },
    pendingReviews,
    latestReviews,
    exchanges,
    assets,
    blogPosts,
    directionSeoTexts,
    legalDocuments,
    wikiEntries,
    contactLinks,
    banners,
    contactMessages,
    complaints,
    auditLogs,
    dbUsers,
    enums: {
      exchangeStatuses: Object.values(ExchangeStatus),
      moderationStatuses: Object.values(ModerationStatus),
      publishStatuses: Object.values(PublishStatus),
      supportStatuses: Object.values(SupportStatus),
      complaintStatuses: Object.values(ComplaintStatus),
      apiCredentialStatuses: Object.values(ApiCredentialStatus)
    }
  };
}
