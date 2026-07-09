import Link from "next/link";
import { AdBanner } from "@/components/ad-banner";
import { AppShell } from "@/components/app-shell";
import { loadDashboardSnapshot, statusLabel } from "@/lib/dashboard-data";
import { requireAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Кабинет обменника - monik exchange"
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export default async function OwnerDashboardPage() {
  const session = await requireAuthRole(["ADMIN", "OWNER"], "/dashboard/owner");
  const snapshot = await loadDashboardSnapshot(session.exchangeId);

  return (
    <AppShell footer>
      <section className="dashboardPage ownerDashboard">
        <div className="dashboardTitle">
          <div>
            <span className="eyebrow">Owner dashboard</span>
            <h1>Кабинет обменника</h1>
            <p>Профили, отзывы, жалобы и подготовка к подключению фидов обменника.</p>
          </div>
          <Link className="loginButton" href="/contacts">Связаться</Link>
        </div>

        {snapshot.degraded && (
          <div className="userNoticePanel">
            <span aria-hidden="true">!</span>
            <p>База данных временно недоступна. После деплоя таблицы будут подготовлены автоматически.</p>
          </div>
        )}

        <AdBanner placement="dashboard-top" />

        <div className="ownerDataGrid">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Profile</span>
                <h2>Сводка владельца</h2>
              </div>
            </div>
            <div className="ownerInfoGrid">
              <div><span>Активные профили</span><strong>{snapshot.counts.activeExchanges}</strong></div>
              <div><span>Отзывы на проверке</span><strong>{snapshot.counts.pendingReviews}</strong></div>
              <div><span>Опубликованные отзывы</span><strong>{snapshot.counts.publishedReviews}</strong></div>
              <div><span>Статус фидов</span><strong>Готово к подключению</strong></div>
            </div>
          </section>

          <section className="panel" id="feeds">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Feeds</span>
                <h2>Подключение данных</h2>
              </div>
              {session.role === "ADMIN" && (
                <Link className="adminPreviewLink" href="/admin?section=exchanges">
                  Добавить Pull URL JSON-фида
                </Link>
              )}
            </div>
            <div className="feedStatusGrid">
              <div><span>API</span><strong>ожидает ключ владельца</strong></div>
              <div><span>Формат</span><strong>JSON feed готов</strong></div>
              <div><span>Модерация</span><strong>{snapshot.counts.pendingReviews} новых</strong></div>
              <div><span>Поддержка</span><strong>через форму контактов</strong></div>
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Exchanges</span>
              <h2>Профили обменников</h2>
            </div>
          </div>
          {snapshot.exchanges.length ? (
            <div className="ownerOfferTable tableLike">
              {snapshot.exchanges.map((exchange) => (
                <div key={exchange.id}>
                  <span><strong>{exchange.name}</strong><small>{exchange.domain}</small></span>
                  <span>{statusLabel(exchange.status)}</span>
                  <span>{exchange._count.reviews} отзывов</span>
                  <span>{exchange.verifiedAt ? "Проверен" : "Не проверен"}</span>
                  <span>{formatDate(exchange.createdAt)}</span>
                  <span><Link href={`/exchangers/${exchange.slug}`}>Открыть</Link></span>
                </div>
              ))}
            </div>
          ) : (
            <p className="publicLead">Профили появятся после первого отзыва или импорта обменников.</p>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Feedback</span>
              <h2>Последние отзывы и жалобы</h2>
            </div>
          </div>
          {snapshot.latestReviews.length ? (
            <div className="ownerReviewList">
              {snapshot.latestReviews.map((review) => (
                <article key={review.id}>
                  <strong>{review.exchange.name} - {review.rating}/5</strong>
                  <small>{formatDate(review.createdAt)} · {statusLabel(review.status)} · заявка {review.transactionRef ?? "без номера"}</small>
                  <p>{review.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="publicLead">Новых отзывов пока нет.</p>
          )}
        </section>
      </section>
    </AppShell>
  );
}
