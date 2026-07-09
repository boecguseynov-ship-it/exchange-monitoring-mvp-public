import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { loadLiveExchangeProfile } from "@/lib/bestchange/service";
import { localChangers } from "@/lib/bestchange/local";
import { FeedbackPanel } from "./feedback-panel";

export const dynamic = "force-dynamic";

const SITE_NAME = "monik exchange";

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
    description: `Активен · резерв ${fallback.reserve.toLocaleString("ru-RU")}`,
    domain: new URL(fallback.urls.ru ?? "https://example.com").hostname,
    url: fallback.urls.ru ?? Object.values(fallback.urls)[0] ?? null,
    rating: null,
    reviews: 0,
    activeClaims: fallback.reviews?.claim ?? null,
    closedClaims: fallback.reviews?.closed ?? null,
    reserve: fallback.reserve,
    reserveLabel: fallback.reserve.toLocaleString("ru-RU"),
    insuranceDeposit: null,
    noAml: false,
    verified: fallback.active,
    status: fallback.active ? "Активен" : "Отключен",
    languages: fallback.langs,
    facts: [
      { label: "Сумма резервов", value: fallback.reserve.toLocaleString("ru-RU") },
      { label: "Языки", value: fallback.langs.join(", ") },
      { label: "Статус", value: fallback.active ? "Активен" : "Отключен" }
    ],
    localReviews: [],
    externalReviews: []
  };
}

function formatReviewDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value);
}

function ratingLabel(rating: number | null, reviews: number) {
  return rating === null || reviews === 0 ? `нет оценки / ${reviews}` : `${rating.toFixed(1)} / ${reviews}`;
}

function reserveLabel(value: number, fallback: string) {
  if (Number.isFinite(value) && value > 0) {
    return `${Math.round(value).toLocaleString("ru-RU")} $`;
  }

  return fallback;
}

function securityVerdict(score: number) {
  if (score >= 85) {
    return {
      className: "excellent",
      label: "\u041e\u0442\u043b\u0438\u0447\u043d\u044b\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c",
      caption: "\u041c\u043e\u0436\u043d\u043e \u0440\u0430\u0441\u0441\u043c\u0430\u0442\u0440\u0438\u0432\u0430\u0442\u044c",
      explain: "\u0421\u0438\u043b\u044c\u043d\u044b\u0435 \u0441\u0438\u0433\u043d\u0430\u043b\u044b \u0434\u043e\u0432\u0435\u0440\u0438\u044f. \u041f\u0435\u0440\u0435\u0434 \u043e\u043f\u043b\u0430\u0442\u043e\u0439 \u0441\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u0443\u043c\u043c\u0443 \u0438 \u0434\u043e\u043c\u0435\u043d."
    };
  }

  if (score >= 70) {
    return {
      className: "good",
      label: "\u0425\u043e\u0440\u043e\u0448\u0438\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c",
      caption: "\u0412 \u0446\u0435\u043b\u043e\u043c \u043d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e",
      explain: "\u041c\u043e\u0436\u043d\u043e \u0440\u0430\u0441\u0441\u043c\u0430\u0442\u0440\u0438\u0432\u0430\u0442\u044c, \u043d\u043e \u043f\u0435\u0440\u0435\u0434 \u0437\u0430\u044f\u0432\u043a\u043e\u0439 \u043f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u043e\u043c\u0435\u043d, \u0440\u0435\u0437\u0435\u0440\u0432 \u0438 \u0443\u0441\u043b\u043e\u0432\u0438\u044f."
    };
  }

  if (score >= 55) {
    return {
      className: "watch",
      label: "\u041d\u0443\u0436\u043d\u043e \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c",
      caption: "\u0415\u0441\u0442\u044c \u043f\u043e\u0432\u043e\u0434 \u0434\u043b\u044f \u043f\u0430\u0443\u0437\u044b",
      explain: "\u041b\u0443\u0447\u0448\u0435 \u0441\u043d\u0430\u0447\u0430\u043b\u0430 \u0438\u0437\u0443\u0447\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432\u044b, \u043f\u0440\u0435\u0442\u0435\u043d\u0437\u0438\u0438 \u0438 \u0442\u043e\u0447\u043d\u044b\u0435 \u043b\u0438\u043c\u0438\u0442\u044b."
    };
  }

  return {
    className: "risk",
    label: "\u0412\u044b\u0441\u043e\u043a\u0438\u0439 \u0440\u0438\u0441\u043a",
    caption: "\u041d\u0435 \u0441\u043f\u0435\u0448\u0438\u0442\u0435 \u0441 \u043e\u043f\u043b\u0430\u0442\u043e\u0439",
    explain: "\u041c\u0430\u043b\u043e \u0441\u0438\u0433\u043d\u0430\u043b\u043e\u0432 \u0434\u043e\u0432\u0435\u0440\u0438\u044f. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0431\u043e\u043b\u0435\u0435 \u043d\u0430\u0434\u0435\u0436\u043d\u044b\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442 \u0438\u043b\u0438 \u043f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0432\u0441\u0435 \u0434\u0435\u0442\u0430\u043b\u0438."
  };
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span>
      {Array.from({ length: Math.max(1, Math.min(5, Math.round(rating))) }).map((_, index) => (
        <Star fill="currentColor" key={index} size={14} />
      ))}
    </span>
  );
}

export async function generateMetadata({ params }: ExchangePageProps) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  return { title: profile ? `${profile.name} — ${SITE_NAME}` : `Обменник — ${SITE_NAME}` };
}

export default async function ExchangeProfilePage({ params }: ExchangePageProps) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) notFound();

  const initials = profile.name.slice(0, 2).toUpperCase();
  const websiteHref = profile.url ?? (profile.domain ? `https://${profile.domain}` : null);
  const websiteLabel = profile.domain ?? (websiteHref ? new URL(websiteHref).hostname.replace(/^www\./i, "") : null);
  const statusLabel = profile.verified ? "активен" : "отключен";
  const securityScore = profile.reviews > 0 ? 87 : 72;
  const securityScoreVerdict = securityVerdict(securityScore);
  const noData = "не указан";
  const normalizeFactLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "");
  const factByLabel = (labels: string[], fallback: string) => {
    const normalizedLabels = new Set(labels.map(normalizeFactLabel));
    const fact = profile.facts.find((item) => normalizedLabels.has(normalizeFactLabel(item.label)));
    return fact?.value?.trim() || fallback;
  };
  const ageValue = factByLabel(["Возраст", "Age"], noData);
  const listedValue = factByLabel(["На monik exchange", "На BestChange", "Listed"], noData);
  const countryValue = factByLabel(["Страна", "Country"], noData);
  const amlValue = factByLabel(["AML-прозрачность", "AML"], profile.noAml ? "без AML" : "AML");
  const currencyCountValue = factByLabel(["Всего валют", "Валюты", "Currencies"], noData);
  const ratesCountValue = factByLabel(["Курсов обмена", "Курсы", "Rates"], noData);
  const reserveValue = reserveLabel(profile.reserve, profile.reserveLabel);
  const claimsValue = `${profile.activeClaims ?? 0} / ${profile.closedClaims ?? 0}`;
  const descriptionText = profile.description.replace(/\s*·\s*/g, " · ").trim();
  const combinedReviews = [
    ...profile.localReviews.map((review) => ({
      id: `local-${review.id}`,
      author: review.author,
      body: review.body,
      rating: review.rating,
      kindLabel: null,
      createdAtLabel: formatReviewDate(review.createdAt),
      createdAt: review.createdAt.toISOString()
    })),
    ...profile.externalReviews.map((review) => ({
      id: `external-${review.id}`,
      author: review.author,
      body: review.body,
      rating: review.rating,
      kindLabel: review.kindLabel,
      createdAtLabel: review.createdAtLabel,
      createdAt: review.createdAt
    }))
  ];
  const visibleReviews = combinedReviews.slice(0, 5);
  const visibleReviewCount = visibleReviews.length;
  const reviewCount = visibleReviewCount || profile.reviews;

  return (
    <AppShell footer>
      <div className="docsPage exchangeProfilePage">
        <section className="exchangePassport">
          <div className="exchangePassportHead">
            <div className="exchangeProfilePreview" aria-hidden="true">
              <div className="previewTop"><span /></div>
              <div className="previewBrand">{initials}</div>
              <div className="previewGrid"><span /><span /><span /><span /><span /><span /></div>
              <div className="previewCard"><i /><i /><i /></div>
            </div>

            <div className="exchangePassportTitle">
              <div className="exchangePassportTopline">
                <h1>Обменный пункт {profile.name}</h1>
                <Link href="/exchangers">Другие обменники</Link>
              </div>
              <div className="exchangePassportLinks">
                {websiteHref && (
                  <a href={websiteHref} rel="noopener noreferrer" target="_blank">
                    Сайт: {websiteLabel ?? profile.name}
                  </a>
                )}
                <a href="#exchange-feedback">Написать отзыв об обменном пункте</a>
              </div>
              <div className={profile.insuranceDeposit ? "exchangeDepositBadge active" : "exchangeDepositBadge"}>
                <span>Страховой депозит</span>
                <strong>{profile.insuranceDeposit || "не указан"}</strong>
              </div>
              <p className="exchangePassportDescription">{descriptionText}</p>
            </div>
          </div>

          <div className="exchangeProfileSummary" aria-label="Краткая сводка обменного пункта">
            <div>
              <span>Отзывы</span>
              <strong>{ratingLabel(profile.rating, reviewCount)}</strong>
              <small>публичная репутация</small>
            </div>
            <div>
              <span>Претензии</span>
              <strong>{claimsValue}</strong>
              <small>активные / закрытые</small>
            </div>
            <div>
              <span>Резерв</span>
              <strong>{reserveValue}</strong>
              <small>сумма доступных средств</small>
            </div>
            <div>
              <span>Валюты</span>
              <strong>{currencyCountValue}</strong>
              <small>направления и активы</small>
            </div>
          </div>

          <div className="exchangePassportStats">
            <dl>
              <div>
                <dt>Статус:</dt>
                <dd><span className={profile.verified ? "exchangeStatusPill active" : "exchangeStatusPill watch"}>{statusLabel}</span></dd>
              </div>
              <div><dt>{"\u0412\u043e\u0437\u0440\u0430\u0441\u0442:"}</dt><dd>{ageValue}</dd></div>
              <div><dt>{"\u041d\u0430 monik exchange:"}</dt><dd>{listedValue}</dd></div>
              <div><dt>{"\u0421\u0442\u0440\u0430\u043d\u0430:"}</dt><dd>{countryValue}</dd></div>
              <div><dt>{"AML-\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u044c:"}</dt><dd>{amlValue}</dd></div>
            </dl>
            <dl>
              <div><dt>{"\u041e\u0442\u0437\u044b\u0432\u044b:"}</dt><dd>{ratingLabel(profile.rating, reviewCount)}</dd></div>
              <div><dt>{"\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0445 \u043f\u0440\u0435\u0442\u0435\u043d\u0437\u0438\u0439:"}</dt><dd>{claimsValue}</dd></div>
              <div><dt>{"\u0421\u0442\u0440\u0430\u0445\u043e\u0432\u043e\u0439 \u0434\u0435\u043f\u043e\u0437\u0438\u0442:"}</dt><dd>{profile.insuranceDeposit || "\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"}</dd></div>
              <div><dt>{"\u0412\u0441\u0435\u0433\u043e \u0432\u0430\u043b\u044e\u0442:"}</dt><dd>{currencyCountValue}</dd></div>
              <div><dt>{"\u041a\u0443\u0440\u0441\u043e\u0432 \u043e\u0431\u043c\u0435\u043d\u0430:"}</dt><dd>{ratesCountValue}</dd></div>
              <div><dt>{"\u0421\u0443\u043c\u043c\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u043e\u0432:"}</dt><dd>{reserveValue}</dd></div>
            </dl>
          </div>
        </section>

        <div className="exchangeProfileMain">
        <section className="exchangeReviewBoard" id="exchange-feedback">
          <div className="exchangeReviewIntro">
            <span>{"\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043e\u0431\u043c\u0435\u043d\u043d\u0438\u043a\u0430"}</span>
            <h2>{profile.name}: {"\u043a\u0443\u0440\u0441\u044b, \u0440\u0435\u0437\u0435\u0440\u0432 \u0438 \u043e\u0442\u0437\u044b\u0432\u044b \u043f\u0440\u043e \u043e\u0431\u043c\u0435\u043d\u043d\u0438\u043a"}</h2>
            <p>{descriptionText}</p>
          </div>

          <div className="exchangeReviewToolbar">
            <div>
              <h3>{"\u041e\u0442\u0437\u044b\u0432\u044b"} ({visibleReviewCount})</h3>
              <a className="exchangeAddReview" href="#exchange-feedback-form">{"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432"}</a>
            </div>
            <div className="exchangeReviewFilters" aria-label="Фильтры отзывов">
              <span className="active">{"\u0412\u0441\u0435"}</span>
              <span>{"\u041f\u043e\u043b\u043e\u0436\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435"}</span>
              <span>{"\u041d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u044b\u0435"}</span>
              <span>{"\u041d\u0435\u0433\u0430\u0442\u0438\u0432\u043d\u044b\u0435"}</span>
            </div>
          </div>

          <div className="exchangeReviewSurface">
            {visibleReviews.length > 0 ? (
              <div className="externalReviewList">
                {visibleReviews.map((review) => (
                  <article key={review.id}>
                    <div>
                      <strong>{review.author}</strong>
                      {review.rating ? <ReviewStars rating={review.rating} /> : <span>{review.kindLabel}</span>}
                      {review.createdAtLabel && <time dateTime={review.createdAt ?? undefined}>{review.createdAtLabel}</time>}
                    </div>
                    <p>{review.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="exchangeEmptyReviews">
                <strong>{"\u041e\u0442\u0437\u044b\u0432\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442"}</strong>
                <span>{"\u0411\u0443\u0434\u044c\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u043c, \u043a\u0442\u043e \u0440\u0430\u0441\u0441\u043a\u0430\u0436\u0435\u0442 \u043e \u0441\u043a\u043e\u0440\u043e\u0441\u0442\u0438, \u043a\u0443\u0440\u0441\u0435 \u0438 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0435 \u044d\u0442\u043e\u0433\u043e \u043e\u0431\u043c\u0435\u043d\u043d\u0438\u043a\u0430."}</span>
              </div>
            )}

            <details className="exchangeFeedbackDetails" id="exchange-feedback-form">
              <summary>{"\u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043e\u0442\u0437\u044b\u0432 \u0438\u043b\u0438 \u0436\u0430\u043b\u043e\u0431\u0443"}</summary>
              <FeedbackPanel exchangeSlug={profile.slug} />
            </details>
          </div>
        </section>

        <section className="panel securityOverview" id="exchange-statistics">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">KYC / AML</span>
              <h2>Проверка безопасности</h2>
            </div>
            <ShieldCheck size={24} />
          </div>
          <div className="securityOverviewGrid">
            <div className={`securityScoreCard ${securityScoreVerdict.className}`}>
              <div className="securityScoreTop">
                <strong>{securityScore}<span>{"\u0438\u0437 100"}</span></strong>
                <b>{securityScoreVerdict.label}</b>
              </div>
              <div className="securityScoreMeter" aria-label={`\u041e\u0446\u0435\u043d\u043a\u0430 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438 ${securityScore} \u0438\u0437 100`}>
                <i style={{ width: `${securityScore}%` }} />
              </div>
              <span>{securityScoreVerdict.caption}</span>
              <small>{securityScoreVerdict.explain}</small>
            </div>
            <div><strong>KYC по запросу</strong><span>Режим идентификации</span></div>
            <div><strong>{profile.noAml ? "Без AML" : "AML: низкий риск"}</strong><span>{profile.noAml ? "Метка задана в админке" : "AML"}</span></div>
            <div className={profile.insuranceDeposit ? "securityDepositCard active" : "securityDepositCard"}>
              <strong>{profile.insuranceDeposit || "не указан"}</strong>
              <span>Страховой депозит обменника</span>
            </div>
          </div>
        </section>
        </div>
      </div>
    </AppShell>
  );
}
