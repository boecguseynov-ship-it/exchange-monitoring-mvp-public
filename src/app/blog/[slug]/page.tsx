import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { blogArticles } from "@/features/public-content/content";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogArticles.map((article) => ({ slug: article.id }));
}

export async function generateMetadata({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = blogArticles.find((item) => item.id === slug);
  return { title: article ? `${article.title} — RateScope` : "Блог — RateScope" };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = blogArticles.find((item) => item.id === slug);
  if (!article) notFound();

  const paragraphs = [
    article.excerpt,
    "Перед обменом сравните не только верхний курс, но и лимиты, резерв, сеть перевода, свежесть обновления и публичную историю обменного пункта.",
    "Если курс отличается от рынка слишком резко, проверьте домен, условия заявки и возможные комиссии. Для крупной суммы разумно начать с меньшего тестового перевода.",
    "RateScope помогает быстро отсеять рискованные варианты, но финальные условия всегда подтверждайте на сайте выбранного обменника до оплаты."
  ];

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
        <div className="blogArticleBody">
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </article>
    </AppShell>
  );
}
