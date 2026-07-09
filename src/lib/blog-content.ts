import { PublishStatus } from "@prisma/client";
import { blogArticles, type BlogArticle } from "@/features/public-content/content";
import { prisma } from "@/lib/db/prisma";

function fallbackBody(article: BlogArticle) {
  return [
    article.excerpt,
    "Перед обменом сравните не только верхний курс, но и лимиты, резерв, сеть перевода, свежесть обновления и публичную историю обменного пункта.",
    "Если курс отличается от рынка слишком резко, проверьте домен, условия заявки и возможные комиссии.",
    "monik exchange помогает быстро отсеять рискованные варианты, но финальные условия всегда подтверждайте на сайте выбранного обменника до оплаты."
  ].join("\n\n");
}

function fallbackArticles() {
  return blogArticles.map((article) => ({
    ...article,
    seoTitle: null,
    seoDescription: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    body: article.body ?? fallbackBody(article),
    status: "PUBLISHED",
    publishedAt: new Date()
  }));
}

function mapPost(post: {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  body: string;
  category: string;
  readTime: string;
  accent: string;
  symbol: string;
  status: PublishStatus;
  publishedAt: Date;
}) {
  return {
    id: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    ogTitle: post.ogTitle,
    ogDescription: post.ogDescription,
    ogImage: post.ogImage,
    body: post.body,
    category: post.category,
    readTime: post.readTime,
    accent: post.accent,
    symbol: post.symbol,
    status: post.status,
    publishedAt: post.publishedAt,
    date: new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(post.publishedAt)
  };
}

export async function loadBlogArticles({ includeHidden = false } = {}) {
  try {
    const posts = await prisma.blogPost.findMany({
      where: includeHidden ? undefined : { status: PublishStatus.PUBLISHED },
      orderBy: [{ publishedAt: "desc" }, { title: "asc" }]
    });
    return posts.map(mapPost);
  } catch {
    return fallbackArticles();
  }
}

export async function loadBlogArticle(slug: string) {
  const articles = await loadBlogArticles();
  return articles.find((article) => article.id === slug) ?? null;
}
