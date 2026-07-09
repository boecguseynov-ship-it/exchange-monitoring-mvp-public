import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { loadBlogArticle, loadBlogArticles } from "@/lib/blog-content";
import { formatArticleBody } from "@/lib/formatter";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const articles = await loadBlogArticles();
  return articles.map((article) => ({ slug: article.id }));
}

export async function generateMetadata({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = await loadBlogArticle(slug);
  if (!article) return { title: "Блог — monik exchange" };

  const title = article.seoTitle?.trim() || `${article.title} — monik exchange`;
  const description = article.seoDescription?.trim() || article.excerpt;
  const ogTitle = article.ogTitle?.trim() || title;
  const ogDescription = article.ogDescription?.trim() || description;
  const images = article.ogImage?.trim() ? [article.ogImage.trim()] : undefined;

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "article",
      images
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      images
    }
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = await loadBlogArticle(slug);
  if (!article) notFound();

  const formattedHtml = formatArticleBody(article.body ?? article.excerpt);

  return (
    <AppShell footer>
      <article className="publicPage blogArticlePage">
        <Link className="backLink" href="/blog"><ArrowLeft size={14} />Все статьи</Link>
        <header className="blogArticleHero">
          <div>
            <span>{article.category}</span>
            <h1>{article.title}</h1>
            <p>{article.excerpt}</p>
            <small>{article.date} · {article.readTime}</small>
          </div>
          <div className="articleArt" style={{ background: article.accent }}>
            <span>{article.symbol}</span>
          </div>
        </header>
        <div className="blogArticleBody" dangerouslySetInnerHTML={{ __html: formattedHtml }} />
      </article>
    </AppShell>
  );
}
