"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as argon2 from "argon2";
import {
  ApiCredentialStatus,
  ComplaintStatus,
  ExchangeStatus,
  ModerationStatus,
  PublishStatus,
  SupportStatus
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { syncAllExchangesFromProvider } from "@/lib/admin-data";
import { bannerPlacements, getBannerSlotDocs, type BannerPlacement } from "@/lib/banners";
import { contactSocialLinkGroup } from "@/lib/site-links";
import { assertAuthRole } from "@/lib/auth";
import { normalizeDirectionSeoSlug } from "@/lib/direction-seo";

function text(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function enumValue<T extends Record<string, string>>(source: T, value: string, fallback: T[keyof T]) {
  return Object.values(source).includes(value) ? value as T[keyof T] : fallback;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    || `item-${Date.now()}`;
}

async function audit(action: string, targetType: string, targetId?: string, details?: string) {
  await prisma.auditLog.create({
    data: { action, targetType, targetId, details, actor: "admin@ratescope.local" }
  });
}

function refreshAdmin() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/wiki");
  revalidatePath("/contacts");
  revalidatePath("/privacy");
  revalidatePath("/terms");
  revalidatePath("/exchangers");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/owner");
}

function bannerPlacement(value: string): BannerPlacement {
  return bannerPlacements.includes(value as BannerPlacement) ? value as BannerPlacement : "site-top";
}

async function requireAdminAction() {
  await assertAuthRole(["ADMIN"]);
}

export async function saveExchangeAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const slug = slugify(text(formData, "slug", name));
  const domain = text(formData, "domain");

  if (!name || !domain) {
    redirect(`/admin?section=exchanges&error=${encodeURIComponent("Название и домен обязательны для заполнения.")}`);
  }

  const data = {
    name,
    slug,
    domain,
    supportEmail: text(formData, "supportEmail", `support+${slug}@ratescope.local`),
    termsUrl: text(formData, "termsUrl") || null,
    partnerUrl: text(formData, "partnerUrl") || null,
    insuranceDeposit: text(formData, "insuranceDeposit") || null,
    noAml: checked(formData, "noAml"),
    description: text(formData, "description", "Профиль обменника управляется из админки."),
    status: enumValue(ExchangeStatus, text(formData, "status"), ExchangeStatus.ACTIVE),
    isDemo: checked(formData, "isDemo"),
    verifiedAt: checked(formData, "verified") ? new Date() : null
  };

  let errorMsg = "";
  try {
    const exchange = id
      ? await prisma.exchange.update({ where: { id }, data })
      : await prisma.exchange.create({ data });
    await audit(id ? "EXCHANGE_UPDATED" : "EXCHANGE_CREATED", "EXCHANGE", exchange.id, exchange.name);
  } catch (e: any) {
    if (e.code === "P2002") {
      errorMsg = "Обменник с таким slug или доменом уже существует.";
    } else {
      errorMsg = e.message || "Ошибка при сохранении обменника";
    }
  }

  if (errorMsg) {
    redirect(`/admin?section=exchanges&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function syncExchangeDirectoryAction() {
  await requireAdminAction();
  await syncAllExchangesFromProvider();
  refreshAdmin();
}

export async function saveExchangeFeedAction(formData: FormData) {
  await requireAdminAction();
  const exchangeId = text(formData, "exchangeId");
  if (!exchangeId) return;
  await prisma.exchangeFeed.upsert({
    where: { exchangeId },
    update: {
      pullUrl: text(formData, "pullUrl") || null,
      intervalSec: Math.max(60, numberValue(formData, "interval", 300)),
      enabled: checked(formData, "enabled")
    },
    create: {
      exchangeId,
      pullUrl: text(formData, "pullUrl") || null,
      intervalSec: Math.max(60, numberValue(formData, "interval", 300)),
      enabled: checked(formData, "enabled")
    }
  });
  await audit("EXCHANGE_FEED_SAVED", "EXCHANGE", exchangeId);
  refreshAdmin();
}

export async function createApiCredentialAction(formData: FormData) {
  await requireAdminAction();
  const exchangeId = text(formData, "exchangeId");
  if (!exchangeId) return;
  const tokenHint = `rs_${Math.random().toString(36).slice(2, 8)}...${Math.random().toString(36).slice(2, 6)}`;
  await prisma.apiCredential.create({
    data: {
      exchangeId,
      label: text(formData, "label", "Production feed"),
      tokenHint
    }
  });
  await audit("API_KEY_CREATED", "EXCHANGE", exchangeId, tokenHint);
  refreshAdmin();
}

export async function revokeApiCredentialAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  await prisma.apiCredential.update({
    where: { id },
    data: { status: ApiCredentialStatus.REVOKED, revokedAt: new Date() }
  });
  await audit("API_KEY_REVOKED", "API_CREDENTIAL", id);
  refreshAdmin();
}

export async function moderateReviewAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  const status = enumValue(ModerationStatus, text(formData, "status"), ModerationStatus.PUBLISHED);
  await prisma.review.update({ where: { id }, data: { status } });
  await audit("REVIEW_MODERATED", "REVIEW", id, status);
  refreshAdmin();
}

export async function saveAssetAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const code = text(formData, "code").toUpperCase();
  if (!code) return;
  const data = {
    code,
    name: text(formData, "name", code),
    network: text(formData, "network") || null,
    category: text(formData, "category", "other"),
    status: enumValue(PublishStatus, text(formData, "status"), PublishStatus.PUBLISHED),
    source: text(formData, "source", "admin"),
    position: numberValue(formData, "position", 100)
  };
  const asset = id
    ? await prisma.managedAsset.update({ where: { id }, data })
    : await prisma.managedAsset.upsert({ where: { code }, update: data, create: data });
  await audit(id ? "ASSET_UPDATED" : "ASSET_CREATED", "ASSET", asset.id, asset.code);
  refreshAdmin();
}

export async function saveBlogPostAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const title = text(formData, "title");
  if (!title) return;
  const data = {
    slug: slugify(text(formData, "slug", title)),
    title,
    excerpt: text(formData, "excerpt", title),
    seoTitle: text(formData, "seoTitle") || null,
    seoDescription: text(formData, "seoDescription") || null,
    ogTitle: text(formData, "ogTitle") || null,
    ogDescription: text(formData, "ogDescription") || null,
    ogImage: text(formData, "ogImage") || null,
    body: text(formData, "body", title),
    category: text(formData, "category", "monik exchange"),
    readTime: text(formData, "readTime", "5 минут"),
    accent: text(formData, "accent", "#31d3a5"),
    symbol: text(formData, "symbol", "R").slice(0, 3),
    status: enumValue(PublishStatus, text(formData, "status"), PublishStatus.PUBLISHED)
  };

  let errorMsg = "";
  try {
    const post = id
      ? await prisma.blogPost.update({ where: { id }, data })
      : await prisma.blogPost.create({ data });
    await audit(id ? "BLOG_POST_UPDATED" : "BLOG_POST_CREATED", "BLOG_POST", post.id, post.slug);
  } catch (e: any) {
    if (e.code === "P2002") {
      errorMsg = "Статья с таким адресом (slug) или заголовком уже существует. Пожалуйста, укажите уникальный slug или измените заголовок.";
    } else {
      errorMsg = e.message || "Ошибка при сохранении статьи";
    }
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function deleteBlogPostAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  let errorMsg = "";
  try {
    const post = await prisma.blogPost.delete({ where: { id } });
    await audit("BLOG_POST_DELETED", "BLOG_POST", id, post.slug);
  } catch (e: any) {
    errorMsg = e.message || "Ошибка при удалении статьи";
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function saveLegalDocumentAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const slug = slugify(text(formData, "slug"));
  if (!slug) return;
  const data = {
    slug,
    title: text(formData, "title", slug),
    description: text(formData, "description"),
    body: text(formData, "body"),
    status: enumValue(PublishStatus, text(formData, "status"), PublishStatus.PUBLISHED)
  };

  let errorMsg = "";
  try {
    const document = id
      ? await prisma.legalDocument.update({ where: { id }, data })
      : await prisma.legalDocument.upsert({ where: { slug }, update: data, create: data });
    await audit("LEGAL_DOCUMENT_SAVED", "LEGAL_DOCUMENT", document.id, document.slug);
  } catch (e: any) {
    if (e.code === "P2002") {
      errorMsg = "Документ с таким slug уже существует.";
    } else {
      errorMsg = e.message || "Ошибка при сохранении документа";
    }
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function deleteLegalDocumentAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  let errorMsg = "";
  try {
    const doc = await prisma.legalDocument.delete({ where: { id } });
    await audit("LEGAL_DOCUMENT_DELETED", "LEGAL_DOCUMENT", id, doc.slug);
  } catch (e: any) {
    errorMsg = e.message || "Ошибка при удалении документа";
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function saveWikiEntryAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const title = text(formData, "title");
  if (!title) return;
  const data = {
    title,
    description: text(formData, "description", title),
    href: text(formData, "href", "/wiki"),
    anchor: text(formData, "anchor") || null,
    group: text(formData, "group", "Пользователям"),
    icon: text(formData, "icon", "users"),
    position: numberValue(formData, "position", 100),
    status: text(formData, "status", "PUBLISHED")
  };

  let errorMsg = "";
  try {
    const entry = id
      ? await prisma.wikiEntry.update({ where: { id }, data })
      : await prisma.wikiEntry.create({ data });
    await audit(id ? "WIKI_ENTRY_UPDATED" : "WIKI_ENTRY_CREATED", "WIKI_ENTRY", entry.id, entry.title);
  } catch (e: any) {
    errorMsg = e.message || "Ошибка при сохранении элемента базы знаний";
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function deleteWikiEntryAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  let errorMsg = "";
  try {
    const entry = await prisma.wikiEntry.delete({ where: { id } });
    await audit("WIKI_ENTRY_DELETED", "WIKI_ENTRY", id, entry.title);
  } catch (e: any) {
    errorMsg = e.message || "Ошибка при удалении элемента базы знаний";
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function saveDirectionSeoTextAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const slug = normalizeDirectionSeoSlug(text(formData, "slug"));
  const body = text(formData, "body");
  if (!slug || !body) return;

  const data = {
    slug,
    title: text(formData, "title") || null,
    body,
    status: enumValue(PublishStatus, text(formData, "status"), PublishStatus.PUBLISHED)
  };

  let errorMsg = "";
  let updatedSlug = "";
  try {
    const entry = id
      ? await prisma.directionSeoText.update({ where: { id }, data })
      : await prisma.directionSeoText.upsert({ where: { slug }, update: data, create: data });
    updatedSlug = entry.slug;
    await audit(id ? "DIRECTION_SEO_UPDATED" : "DIRECTION_SEO_CREATED", "DIRECTION_SEO", entry.id, entry.slug);
  } catch (e: any) {
    if (e.code === "P2002") {
      errorMsg = "SEO-текст для этого направления уже существует.";
    } else {
      errorMsg = e.message || "Ошибка при сохранении SEO-текста";
    }
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
    if (updatedSlug) {
      revalidatePath(`/${updatedSlug}`);
    }
  }
}

export async function deleteDirectionSeoTextAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  let errorMsg = "";
  let deletedSlug = "";
  try {
    const entry = await prisma.directionSeoText.delete({ where: { id } });
    deletedSlug = entry.slug;
    await audit("DIRECTION_SEO_DELETED", "DIRECTION_SEO", id, entry.slug);
  } catch (e: any) {
    errorMsg = e.message || "Ошибка при удалении SEO-текста";
  }

  if (errorMsg) {
    redirect(`/admin?section=content&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
    if (deletedSlug) {
      revalidatePath(`/${deletedSlug}`);
    }
  }
}

export async function saveContactLinkAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const key = text(formData, "key");
  console.log("saveContactLinkAction called: id =", id, "key =", key);
  console.log("FormData keys:", Array.from(formData.keys()));
  console.log("FormData enabled:", formData.get("enabled"));

  if (!key) return;
  const data = {
    title: text(formData, "label", key),
    description: key,
    href: text(formData, "href", "/contacts"),
    group: contactSocialLinkGroup,
    icon: key,
    position: numberValue(formData, "position", 100),
    status: checked(formData, "enabled") ? "PUBLISHED" : "HIDDEN"
  };

  console.log("WikiEntry data to save:", data);

  let errorMsg = "";
  try {
    const link = id
      ? await prisma.wikiEntry.update({ where: { id }, data })
      : await prisma.wikiEntry.create({ data });
    console.log("WikiEntry saved successfully:", link);
    await audit("CONTACT_LINK_SAVED", "CONTACT_LINK", link.id, key);
  } catch (e: any) {
    console.error("WikiEntry save failed error:", e);
    errorMsg = e.message || "Ошибка при сохранении ссылки";
  }

  if (errorMsg) {
    redirect(`/admin?section=links&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function saveBannerAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const placement = bannerPlacement(text(formData, "placement"));
  const defaults = getBannerSlotDocs().find((slot) => slot.placement === placement)?.defaults;
  const title = text(formData, "title", defaults?.title ?? "\u0420\u0435\u043a\u043b\u0430\u043c\u043d\u044b\u0439 \u0431\u0430\u043d\u043d\u0435\u0440");
  const href = text(formData, "href", defaults?.href ?? "/contacts#feedback");
  if (!href) return;

  const data = {
    placement,
    title,
    text: text(formData, "text", defaults?.text ?? title),
    href,
    image: text(formData, "image") || null,
    alt: text(formData, "alt", defaults?.alt ?? title),
    badge: text(formData, "badge", defaults?.badge ?? "\u0420\u0435\u043a\u043b\u0430\u043c\u0430"),
    status: enumValue(PublishStatus, text(formData, "status"), PublishStatus.PUBLISHED),
    position: numberValue(formData, "position", 100)
  };

  let errorMsg = "";
  try {
    const banner = id
      ? await prisma.banner.update({ where: { id }, data })
      : await prisma.banner.upsert({ where: { placement }, update: data, create: data });
    await audit(id ? "BANNER_UPDATED" : "BANNER_CREATED", "BANNER", banner.id, banner.placement);
  } catch (e: any) {
    errorMsg = e.message || "Ошибка при сохранении баннера";
  }

  if (errorMsg) {
    redirect(`/admin?section=links&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function updateContactMessageStatusAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  const status = enumValue(SupportStatus, text(formData, "status"), SupportStatus.IN_PROGRESS);
  await prisma.contactMessage.update({ where: { id }, data: { status } });
  await audit("CONTACT_MESSAGE_STATUS_CHANGED", "CONTACT_MESSAGE", id, status);
  refreshAdmin();
}

export async function updateComplaintStatusAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;
  const status = enumValue(ComplaintStatus, text(formData, "status"), ComplaintStatus.WAITING_EXCHANGE);
  const note = text(formData, "message");
  await prisma.complaint.update({
    where: { id },
    data: {
      status,
      moderatorNote: note || null
    }
  });
  await audit("COMPLAINT_STATUS_CHANGED", "COMPLAINT", id, status);
  refreshAdmin();
}

export async function saveUserAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const email = text(formData, "email").trim().toLowerCase();
  const role = text(formData, "role", "USER");
  const password = text(formData, "password");
  const exchangeId = text(formData, "exchangeId") || null;

  if (!email) {
    redirect(`/admin?section=users&error=${encodeURIComponent("Email является обязательным полем.")}`);
  }

  let errorMsg = "";
  try {
    const data: any = {
      name,
      email,
      role,
      exchangeId: role === "OWNER" ? exchangeId : null
    };

    if (password) {
      data.passwordHash = await argon2.hash(password);
    }

    if (id) {
      const user = await prisma.user.update({ where: { id }, data });
      await audit("USER_UPDATED", "USER", user.id, user.email || "");
    } else {
      if (!password) {
        throw new Error("Пароль обязателен для нового пользователя.");
      }
      const user = await prisma.user.create({ data });
      await audit("USER_CREATED", "USER", user.id, user.email || "");
    }
  } catch (e: any) {
    if (e.code === "P2002") {
      errorMsg = "Пользователь с таким email уже существует.";
    } else {
      errorMsg = e.message || "Ошибка при сохранении пользователя";
    }
  }

  if (errorMsg) {
    redirect(`/admin?section=users&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}

export async function deleteUserAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return;

  let errorMsg = "";
  try {
    const user = await prisma.user.delete({ where: { id } });
    await audit("USER_DELETED", "USER", id, user.email || "");
  } catch (e: any) {
    errorMsg = e.message || "Ошибка при удалении пользователя";
  }

  if (errorMsg) {
    redirect(`/admin?section=users&error=${encodeURIComponent(errorMsg)}`);
  } else {
    refreshAdmin();
  }
}
