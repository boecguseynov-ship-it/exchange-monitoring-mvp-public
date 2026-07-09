import Link from "next/link";
import { AdBanner } from "@/components/ad-banner";
import { AppShell } from "@/components/app-shell";
import { loadDashboardSnapshot, statusLabel } from "@/lib/dashboard-data";
import { requireAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Кабинет пользователя - monik exchange"
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export default async function UserDashboardPage() {
  await requireAuthRole(["ADMIN", "OWNER", "USER"], "/dashboard");
  const snapshot = await loadDashboardSnapshot();

  return (
    <AppShell footer>
      <section className="dashboardPage userDashboard">
        <div className="dashboardTitle">
          <div>
            <span className="eyebrow">User dashboard</span>
            <h1>Кабинет пользователя</h1>
            <p>Здесь собраны действия пользователя: проверка направлений, отзывы, жалобы и обращения в поддержку.</p>
          </div>
          <Link className="loginButton" href="/exchangers">Выбрать обменник</Link>
        </div>

        {snapshot.degraded && (
          <div className="userNoticePanel">
            <span aria-hidden="true">!</span>
            <p>История отзывов временно недоступна, но публичные формы и мониторинг остаются открытыми.</p>
          </div>
        )}

        <AdBanner placement="dashboard-top" />

        <div className="userActionGrid">
          <Link href="/">
            <strong>Сравнить курс</strong>
            <span>Открыть мониторинг и выбрать безопасное направление обмена.</span>
          </Link>
          <Link href="/exchangers">
            <strong>Оставить отзыв</strong>
            <span>Перейти в профиль обменника и отправить отзыв или жалобу.</span>
          </Link>
          <Link href="/contacts#feedback">
            <strong>Связаться</strong>
            <span>Написать команде monik exchange через рабочую SMTP-форму.</span>
          </Link>
        </div>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Reviews</span>
              <h2>Последние обращения</h2>
            </div>
          </div>
          {snapshot.latestReviews.length ? (
            <div className="ownerReviewList">
              {snapshot.latestReviews.map((review) => (
                <article key={review.id}>
                  <strong>{review.exchange.name} - {review.rating}/5</strong>
                  <small>{formatDate(review.createdAt)} · {statusLabel(review.status)}</small>
                  <p>{review.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="publicLead">Пока нет отзывов. Откройте профиль обменника и оставьте первый отзыв после операции.</p>
          )}
        </section>
      </section>
    </AppShell>
  );
}
