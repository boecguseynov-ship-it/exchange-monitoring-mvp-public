import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { loadBlogArticles } from "@/lib/blog-content";

export const metadata = {
  title: "Блог — monik exchange"
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const articles = await loadBlogArticles();

  return (
    <AppShell footer>
      <section className="publicPage blogPage">
        <span className="eyebrow">Блог</span>
        <h1>Практика безопасного обмена</h1>
        <p className="publicLead">
          Короткие материалы о курсах, резервах, сетях, KYC и выборе обменного пункта.
        </p>
        <div className="articleList">
          {articles.map((article) => (
            <Link className="articleRow" href={`/blog/${article.id}`} key={article.id}>
              <span className="articleCopy">
                <span>{article.category}</span>
                <h2>{article.title}</h2>
                <p>{article.excerpt}</p>
                <small>{article.date} · {article.readTime}</small>
              </span>
              <span className="articleArt" style={{ background: article.accent }}>
                <span>{article.symbol}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
