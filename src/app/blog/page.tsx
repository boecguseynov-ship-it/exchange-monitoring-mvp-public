import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { blogArticles } from "@/features/public-content/content";

export const metadata = {
  title: "Блог — RateScope"
};

export default function BlogPage() {
  return (
    <AppShell footer>
      <section className="publicPage blogPage">
        <span className="eyebrow">Блог</span>
        <h1>Практика безопасного обмена</h1>
        <p className="publicLead">
          Короткие материалы о курсах, резервах, сетях, KYC и выборе обменного пункта.
        </p>
        <div className="articleList">
          {blogArticles.map((article) => (
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
