import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { loadLiveExchangeProfile } from "@/lib/bestchange/service";
import { localChangers } from "@/lib/bestchange/local";

export const dynamic = "force-dynamic";

type ExchangePageProps = {
  params: Promise<{ slug: string }>;
};

async function loadProfile(slug: string) {
  const live = await loadLiveExchangeProfile(slug).catch(() => null);
  if (live) return live;

  const fallback = localChangers.find((changer) => String(changer.id) === slug);
  if (!fallback) return null;

  return {
    slug: String(fallback.id),
    name: fallback.name,
    description: `Активный обменный пункт · резерв ${fallback.reserve.toLocaleString("ru-RU")}`,
    domain: new URL(fallback.urls.ru ?? "https://example.com").hostname,
    rating: null,
    reviews: Object.values(fallback.reviews ?? {}).reduce<number>((sum, value) => sum + Number(value ?? 0), 0),
    activeClaims: fallback.reviews?.claim ?? null,
    closedClaims: fallback.reviews?.closed ?? null,
    reserve: fallback.reserve,
    reserveLabel: fallback.reserve.toLocaleString("ru-RU"),
    verified: fallback.active,
    status: fallback.active ? "Активен" : "Отключен",
    languages: fallback.langs,
    facts: [
      { label: "Статус", value: fallback.active ? "Активен" : "Отключен" },
      { label: "Языки", value: fallback.langs.join(", ") },
      { label: "Резерв", value: fallback.reserve.toLocaleString("ru-RU") }
    ],
    externalReviews: []
  };
}

export async function generateMetadata({ params }: ExchangePageProps) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  return { title: profile ? `${profile.name} — RateScope` : "Обменник — RateScope" };
}

export default async function ExchangeProfilePage({ params }: ExchangePageProps) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) notFound();

  return (
    <AppShell footer>
      <article className="publicPage exchangeProfilePage">
        <Link className="backLink" href="/exchangers"><ArrowLeft size={14} />Каталог</Link>
        <header className="exchangeProfileHero">
          <span className="exchangeName"><i>{profile.name.slice(0, 1).toUpperCase()}</i></span>
          <div>
            <span className={profile.verified ? "exchangeStatusPill active" : "exchangeStatusPill watch"}>{profile.status}</span>
            <h1>{profile.name}</h1>
            <p>{profile.description}</p>
            {profile.domain && <a className="exchangeWebsiteLink" href={`https://${profile.domain}`} rel="noreferrer" target="_blank">{profile.domain}<ExternalLink size={14} /></a>}
          </div>
          <div className="profileRating">
            <strong>{profile.rating?.toFixed(1) ?? "—"}</strong>
            <span><Star size={14} fill="currentColor" /> {profile.reviews} отзывов</span>
          </div>
        </header>
        <section className="exchangePassport" id="profile">
          <div className="exchangePassportStats">
            <dl>
              {profile.facts.map((fact) => (
                <div key={`${fact.label}-${fact.value}`}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </article>
    </AppShell>
  );
}
