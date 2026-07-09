import Link from "next/link";
import { AdBanner } from "@/components/ad-banner";
import { AppShell } from "@/components/app-shell";
import {
  createApiCredentialAction,
  deleteBlogPostAction,
  deleteDirectionSeoTextAction,
  deleteLegalDocumentAction,
  deleteWikiEntryAction,
  moderateReviewAction,
  revokeApiCredentialAction,
  saveAssetAction,
  saveBannerAction,
  saveBlogPostAction,
  saveContactLinkAction,
  saveDirectionSeoTextAction,
  saveExchangeAction,
  saveExchangeFeedAction,
  saveLegalDocumentAction,
  saveWikiEntryAction,
  syncExchangeDirectoryAction,
  updateComplaintStatusAction,
  updateContactMessageStatusAction,
  saveUserAction,
  deleteUserAction
} from "@/lib/admin-actions";
import { DeleteButton } from "@/components/delete-button";
import {
  adminSections,
  formatAdminDate,
  loadAdminConsole,
  parseAdminSection,
  statusLabel,
  type AdminSection
} from "@/lib/admin-data";
import { getBannerSlotDocs } from "@/lib/banners";
import { requireAuthRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Админка - monik exchange"
};

type AdminPageProps = {
  searchParams: Promise<{ section?: string | string[]; q?: string | string[]; page?: string | string[]; error?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positivePage(value: string | string[] | undefined) {
  const page = Number(firstParam(value) ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function exchangePageHref(page: number, query: string) {
  const params = new URLSearchParams({ section: "exchanges" });
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/admin?${params.toString()}`;
}

function SelectField({
  name,
  value,
  values
}: {
  name: string;
  value: string;
  values: string[];
}) {
  return (
    <select name={name} defaultValue={value}>
      {values.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
    </select>
  );
}

function AdminNav({ active, counts }: { active: AdminSection; counts: Awaited<ReturnType<typeof loadAdminConsole>>["counts"] }) {
  const countBySection: Record<AdminSection, number> = {
    moderation: counts.pendingReviews,
    exchanges: counts.exchanges,
    assets: counts.assets,
    content: counts.content,
    links: counts.links,
    support: counts.support,
    audit: counts.audit,
    users: counts.users
  };

  return (
    <nav className="adminSectionNav" aria-label="Разделы админки">
      {adminSections.map((section) => (
        <Link
          className={active === section.key ? "active" : ""}
          href={section.key === "moderation" ? "/admin" : `/admin?section=${section.key}`}
          key={section.key}
          prefetch={false}
        >
          <span>{section.label}</span>
          <strong>{countBySection[section.key]}</strong>
        </Link>
      ))}
    </nav>
  );
}

function ModerationSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  return (
    <>
      <section className="adminPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Раздел 1</span>
            <h2>Модерация отзывов</h2>
            <p>Быстрое решение: опубликовать, скрыть или отклонить отзыв.</p>
          </div>
        </div>
        {data.pendingReviews.length ? (
          <div className="adminCardGrid">
            {data.pendingReviews.map((review) => (
              <article className="adminEditCard" key={review.id}>
                <header>
                  <strong>{review.exchange.name} - {review.rating}/5</strong>
                  <small>{formatAdminDate(review.createdAt)} · заявка {review.transactionRef ?? "без номера"}</small>
                </header>
                <p>{review.body}</p>
                <form action={moderateReviewAction} className="adminInlineForm">
                  <input name="id" type="hidden" value={review.id} />
                  <SelectField name="status" value={review.status} values={data.enums.moderationStatuses} />
                  <button type="submit">Сохранить</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="publicLead">Отзывов в очереди пока нет.</p>
        )}
      </section>
      <section className="adminPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">History</span>
            <h2>Последние отзывы</h2>
          </div>
        </div>
        <div className="adminTable">
          {data.latestReviews.map((review) => (
            <div key={review.id}>
              <span><strong>{review.exchange.name}</strong><small>{review.body}</small></span>
              <span>{review.rating}/5</span>
              <span>{statusLabel(review.status)}</span>
              <span>{formatAdminDate(review.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ExchangesSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  const { page, pageCount, query, total } = data.exchangePagination;

  return (
    <section className="adminPanel">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Раздел 2</span>
          <h2>Обменники и фиды</h2>
          <p>Профили, статусы, pull-фид и push-ключи обменных пунктов.</p>
        </div>
        <form action={syncExchangeDirectoryAction}>
          <button className="adminHeaderButton" type="submit">Обновить каталог</button>
        </form>
      </div>
      <form action="/admin" className="adminSearchForm">
        <input name="section" type="hidden" value="exchanges" />
        <input name="q" defaultValue={query} placeholder="Поиск по названию, slug или домену" />
        <button type="submit">Найти</button>
        {query && <Link href="/admin?section=exchanges" prefetch={false}>Сбросить</Link>}
      </form>
      <p className="adminListSummary">
        Показано {data.exchanges.length} из {total} обменников{query ? ` по запросу "${query}"` : ""}
      </p>
      <details className="adminDetails">
        <summary>Добавить обменник</summary>
        <form action={saveExchangeAction} className="adminFormGrid">
          <input name="name" placeholder="Название" />
          <input name="slug" placeholder="slug" />
          <input name="domain" placeholder="domain.com" />
          <input name="supportEmail" placeholder="support@domain.com" />
          <input name="termsUrl" placeholder="URL правил" />
          <input name="partnerUrl" placeholder="Реферальная ссылка (https://obmennik.com?ref=123)" />
          <input name="insuranceDeposit" placeholder="Страховой депозит, например $10 000" />
          <SelectField name="status" value="ACTIVE" values={data.enums.exchangeStatuses} />
          <label><input name="noAml" type="checkbox" /> Работает без AML</label>
          <label><input name="verified" type="checkbox" defaultChecked /> проверен</label>
          <label><input name="isDemo" type="checkbox" /> демо</label>
          <textarea name="description" placeholder="Описание" />
          <button type="submit">Добавить обменник</button>
        </form>
      </details>
      <div className="adminCardGrid">
        {data.exchanges.map((exchange) => {
          const feed = exchange.feeds[0];
          const activeKeys = exchange.apiKeys.filter((key: { status: string }) => key.status === "ACTIVE");
          return (
            <article className="adminEditCard" key={exchange.id}>
              <header>
                <strong>{exchange.name}</strong>
                <small>{exchange.domain} · {exchange._count.reviews} отзывов · {exchange._count.complaints} жалоб</small>
              </header>
              <form action={saveExchangeAction} className="adminFormGrid">
                <input name="id" type="hidden" value={exchange.id} />
                <input name="name" defaultValue={exchange.name} />
                <input name="slug" defaultValue={exchange.slug} />
                <input name="domain" defaultValue={exchange.domain} />
                <input name="supportEmail" defaultValue={exchange.supportEmail} />
                <input name="termsUrl" defaultValue={exchange.termsUrl ?? ""} />
                <input name="partnerUrl" defaultValue={exchange.partnerUrl ?? ""} placeholder="Реферальная ссылка (https://obmennik.com?ref=123)" />
                <input name="insuranceDeposit" defaultValue={exchange.insuranceDeposit ?? ""} placeholder="Страховой депозит" />
                <SelectField name="status" value={exchange.status} values={data.enums.exchangeStatuses} />
                <label><input name="noAml" type="checkbox" defaultChecked={exchange.noAml} /> Работает без AML</label>
                <label><input name="verified" type="checkbox" defaultChecked={Boolean(exchange.verifiedAt)} /> проверен</label>
                <label><input name="isDemo" type="checkbox" defaultChecked={exchange.isDemo} /> демо</label>
                <textarea name="description" defaultValue={exchange.description} />
                <button type="submit">Сохранить</button>
              </form>
              <form action={saveExchangeFeedAction} className="adminInlineForm">
                <input name="exchangeId" type="hidden" value={exchange.id} />
                <input name="pullUrl" placeholder="Pull URL JSON-фида" defaultValue={feed?.pullUrl ?? ""} />
                <input name="interval" type="number" min={60} defaultValue={feed?.intervalSec ?? 300} />
                <label><input name="enabled" type="checkbox" defaultChecked={feed?.enabled ?? true} /> фид включен</label>
                <button type="submit">Сохранить фид</button>
              </form>
              <form action={createApiCredentialAction} className="adminInlineForm">
                <input name="exchangeId" type="hidden" value={exchange.id} />
                <input name="label" placeholder="Название push-ключа" defaultValue="Production feed" />
                <button type="submit">Создать push-ключ</button>
              </form>
              {activeKeys.length > 0 && (
                <div className="adminTokenList">
                  {activeKeys.map((key: { id: string; label: string; tokenHint: string }) => (
                    <form action={revokeApiCredentialAction} key={key.id}>
                      <input name="id" type="hidden" value={key.id} />
                      <span>{key.label} · {key.tokenHint}</span>
                      <button type="submit">Отозвать</button>
                    </form>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {pageCount > 1 && (
        <nav className="adminPagination" aria-label="Страницы обменников">
          {page > 1 ? (
            <Link href={exchangePageHref(page - 1, query)} prefetch={false}>Назад</Link>
          ) : (
            <span>Назад</span>
          )}
          <strong>Страница {page} из {pageCount}</strong>
          {page < pageCount ? (
            <Link href={exchangePageHref(page + 1, query)} prefetch={false}>Вперёд</Link>
          ) : (
            <span>Вперёд</span>
          )}
        </nav>
      )}
    </section>
  );
}

function AssetsSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  return (
    <section className="adminPanel">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Раздел 3</span>
          <h2>Валюты и API</h2>
          <p>Справочник активов для направлений, сетей и публичного API.</p>
        </div>
      </div>
      <details className="adminDetails">
        <summary>Добавить валюту</summary>
        <form action={saveAssetAction} className="adminFormGrid">
          <input name="code" placeholder="BTC" />
          <input name="name" placeholder="Bitcoin" />
          <input name="network" placeholder="BTC / TRC20 / ERC20" />
          <input name="category" placeholder="crypto / bank / cash" />
          <input name="position" type="number" defaultValue={100} />
          <SelectField name="status" value="PUBLISHED" values={data.enums.publishStatuses} />
          <button type="submit">Сохранить валюту</button>
        </form>
      </details>
      <div className="adminTable adminAssetTable">
        {data.assets.map((asset) => (
          <form action={saveAssetAction} key={asset.id}>
            <input name="id" type="hidden" value={asset.id} />
            <input name="code" defaultValue={asset.code} />
            <input name="name" defaultValue={asset.name} />
            <input name="network" defaultValue={asset.network ?? ""} />
            <input name="category" defaultValue={asset.category} />
            <input name="position" type="number" defaultValue={asset.position} />
            <SelectField name="status" value={asset.status} values={data.enums.publishStatuses} />
            <button type="submit">Сохранить</button>
          </form>
        ))}
      </div>
    </section>
  );
}

function ContentSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  return (
    <>
      <section className="adminPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Раздел 4</span>
            <h2>Контент сайта</h2>
            <p>Статьи блога, база знаний и правовые страницы.</p>
          </div>
        </div>
        <details className="adminDetails">
          <summary>Новая статья</summary>
          <form action={saveBlogPostAction} className="adminFormGrid">
            <input name="title" placeholder="Заголовок" />
            <input name="slug" placeholder="slug" />
            <input name="category" placeholder="monik exchange" />
            <input name="readTime" placeholder="5 минут" />
            <input name="accent" placeholder="#31d3a5" />
            <input name="symbol" placeholder="R" />
            <SelectField name="status" value="PUBLISHED" values={data.enums.publishStatuses} />
            <textarea name="excerpt" placeholder="Короткое описание" />
            <input name="seoTitle" placeholder="SEO title" />
            <textarea name="seoDescription" placeholder="SEO description" />
            <input name="ogTitle" placeholder="OGP title" />
            <textarea name="ogDescription" placeholder="OGP description" />
            <input name="ogImage" placeholder="OGP image URL" />
            <textarea name="body" placeholder="Текст статьи" />
            <button type="submit">Опубликовать статью</button>
          </form>
        </details>
        <div className="adminCardGrid compact">
          {data.blogPosts.map((post) => (
            <details className="adminDetails" key={post.id}>
              <summary>{post.title} · {statusLabel(post.status)}</summary>
              <form action={saveBlogPostAction} className="adminFormGrid">
                <input name="id" type="hidden" value={post.id} />
                <input name="title" defaultValue={post.title} />
                <input name="slug" defaultValue={post.slug} />
                <input name="category" defaultValue={post.category} />
                <input name="readTime" defaultValue={post.readTime} />
                <input name="accent" defaultValue={post.accent} />
                <input name="symbol" defaultValue={post.symbol} />
                <SelectField name="status" value={post.status} values={data.enums.publishStatuses} />
                <textarea name="excerpt" defaultValue={post.excerpt} />
                <input name="seoTitle" defaultValue={post.seoTitle ?? ""} placeholder="SEO title" />
                <textarea name="seoDescription" defaultValue={post.seoDescription ?? ""} placeholder="SEO description" />
                <input name="ogTitle" defaultValue={post.ogTitle ?? ""} placeholder="OGP title" />
                <textarea name="ogDescription" defaultValue={post.ogDescription ?? ""} placeholder="OGP description" />
                <input name="ogImage" defaultValue={post.ogImage ?? ""} placeholder="OGP image URL" />
                <textarea name="body" defaultValue={post.body} />
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button type="submit">Сохранить статью</button>
                  <DeleteButton action={deleteBlogPostAction} id={post.id} label={post.title} />
                </div>
              </form>
            </details>
          ))}
        </div>
      </section>
      <section className="adminPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">SEO</span>
            <h2>SEO-тексты направлений</h2>
            <p>Текст показывается внизу страницы направления, сразу под списком обменников.</p>
          </div>
        </div>
        <details className="adminDetails" open>
          <summary>Новый SEO-текст направления</summary>
          <form action={saveDirectionSeoTextAction} className="adminFormGrid">
            <input name="slug" placeholder="russian-ruble-to-usdt-trc20 или полный URL" />
            <input name="title" placeholder="Заголовок блока" />
            <SelectField name="status" value="PUBLISHED" values={data.enums.publishStatuses} />
            <textarea name="body" placeholder="SEO-текст. Абзацы разделяйте пустой строкой." />
            <button type="submit">Сохранить SEO-текст</button>
          </form>
        </details>
        <div className="adminCardGrid compact">
          {data.directionSeoTexts.map((entry) => (
            <details className="adminDetails" key={entry.id}>
              <summary>/{entry.slug} · {statusLabel(entry.status)}</summary>
              <form action={saveDirectionSeoTextAction} className="adminFormGrid">
                <input name="id" type="hidden" value={entry.id} />
                <input name="slug" defaultValue={entry.slug} />
                <input name="title" defaultValue={entry.title ?? ""} />
                <SelectField name="status" value={entry.status} values={data.enums.publishStatuses} />
                <textarea name="body" defaultValue={entry.body} />
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button type="submit">Сохранить SEO-текст</button>
                  <DeleteButton action={deleteDirectionSeoTextAction} id={entry.id} label={`SEO /${entry.slug}`} />
                </div>
              </form>
            </details>
          ))}
        </div>
      </section>
      <section className="adminPanel">
        <div className="panelHeader"><div><span className="eyebrow">Legal</span><h2>Правовые страницы</h2></div></div>
        <div className="adminCardGrid compact">
          {data.legalDocuments.map((document) => (
            <details className="adminDetails" key={document.id}>
              <summary>{document.title} · /{document.slug}</summary>
              <form action={saveLegalDocumentAction} className="adminFormGrid">
                <input name="id" type="hidden" value={document.id} />
                <input name="slug" defaultValue={document.slug} />
                <input name="title" defaultValue={document.title} />
                <SelectField name="status" value={document.status} values={data.enums.publishStatuses} />
                <textarea name="description" defaultValue={document.description} />
                <textarea name="body" defaultValue={document.body} />
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button type="submit">Сохранить документ</button>
                  <DeleteButton action={deleteLegalDocumentAction} id={document.id} label={document.title} />
                </div>
              </form>
            </details>
          ))}
        </div>
      </section>
      <section className="adminPanel">
        <div className="panelHeader"><div><span className="eyebrow">Wiki</span><h2>База знаний</h2></div></div>
        <details className="adminDetails">
          <summary>Новый материал</summary>
          <form action={saveWikiEntryAction} className="adminFormGrid">
            <input name="title" placeholder="Заголовок" />
            <input name="group" placeholder="Пользователям" />
            <input name="href" placeholder="/wiki#section" />
            <input name="anchor" placeholder="section" />
            <input name="icon" placeholder="users" />
            <input name="position" type="number" defaultValue={100} />
            <SelectField name="status" value="PUBLISHED" values={data.enums.publishStatuses} />
            <textarea name="description" placeholder="Описание" />
            <button type="submit">Сохранить материал</button>
          </form>
        </details>
        <div className="adminTable">
          {data.wikiEntries.map((entry) => (
            <form action={saveWikiEntryAction} key={entry.id}>
              <input name="id" type="hidden" value={entry.id} />
              <input name="title" defaultValue={entry.title} />
              <input name="group" defaultValue={entry.group} />
              <input name="href" defaultValue={entry.href} />
              <input name="anchor" defaultValue={entry.anchor ?? ""} />
              <input name="icon" defaultValue={entry.icon} />
              <input name="position" type="number" defaultValue={entry.position} />
              <SelectField name="status" value={entry.status} values={data.enums.publishStatuses} />
              <textarea name="description" defaultValue={entry.description} />
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit">Сохранить</button>
                <DeleteButton action={deleteWikiEntryAction} id={entry.id} label={entry.title} />
              </div>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}

function LinksSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  const bannerSlots = getBannerSlotDocs();
  const bannerByPlacement = new Map(data.banners.map((banner) => [banner.placement, banner]));
  return (
    <>
      <section className="adminPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Раздел 5</span>
            <h2>Публичные ссылки</h2>
            <p>Ссылки блока “Мы в сети” на странице контактов.</p>
          </div>
        </div>
        <div className="adminTable linkTable">
          {data.contactLinks.map((link) => (
            <form action={saveContactLinkAction} key={link.id}>
              <input name="id" type="hidden" value={link.id} />
              <input name="key" type="hidden" value={link.icon} />
              <input name="label" defaultValue={link.title} placeholder="Название" />
              <input name="href" defaultValue={link.href} placeholder="/contacts или https://..." />
              <input name="position" type="number" defaultValue={link.position} />
              <label><input name="enabled" type="checkbox" defaultChecked={link.status === "PUBLISHED"} /> показывать</label>
              <button type="submit">Сохранить ссылку</button>
            </form>
          ))}
        </div>
      </section>
      <section className="adminPanel">
        <div className="panelHeader"><div><span className="eyebrow">Advertising</span><h2>Баннерные места</h2></div></div>
        <div className="bannerSlotList">
          {bannerSlots.map((slot) => {
            const banner = bannerByPlacement.get(slot.placement);
            const selectedStatus = !banner || banner.status === "HIDDEN" ? "PUBLISHED" : banner.status;
            return (
              <details className="adminDetails" key={`${slot.placement}-editor`} open={slot.placement === "site-top"}>
                <summary>{slot.placement} · {banner ? statusLabel(banner.status) : "не создан"}</summary>
                <form action={saveBannerAction} className="adminFormGrid">
                  {banner && <input name="id" type="hidden" value={banner.id} />}
                  <input name="placement" type="hidden" value={slot.placement} />
                  <input name="title" defaultValue={banner?.title ?? slot.defaults.title} placeholder="Заголовок" />
                  <input name="badge" defaultValue={banner?.badge ?? slot.defaults.badge} placeholder="Бейдж" />
                  <input name="href" defaultValue={banner?.href ?? slot.defaults.href} placeholder="/contacts или https://..." />
                  <input name="image" defaultValue={banner?.image ?? ""} placeholder="URL картинки" />
                  <input name="alt" defaultValue={banner?.alt ?? slot.defaults.alt} placeholder="Alt для картинки" />
                  <input name="position" type="number" defaultValue={banner?.position ?? 100} />
                  <SelectField name="status" value={selectedStatus} values={data.enums.publishStatuses} />
                  <textarea name="text" defaultValue={banner?.text ?? slot.defaults.text} placeholder="Текст баннера" />
                  <button type="submit">Сохранить баннер</button>
                </form>
              </details>
            );
          })}
          {bannerSlots.map((slot) => (
            <article key={slot.placement}>
              <strong>{slot.title}</strong>
              <small>{slot.placement}</small>
              <code>{slot.variables.join(" · ")}</code>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SupportSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  return (
    <>
      <section className="adminPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Раздел 6</span>
            <h2>Обращения и жалобы</h2>
            <p>Контактные заявки и спорные ситуации пользователей.</p>
          </div>
        </div>
        <div className="adminCardGrid">
          {data.contactMessages.map((message) => (
            <article className="adminEditCard" key={message.id}>
              <header>
                <strong>{message.email} · {message.subject}</strong>
                <small>{statusLabel(message.status)} · {formatAdminDate(message.createdAt)}</small>
              </header>
              <p>{message.message}</p>
              <form action={updateContactMessageStatusAction} className="adminInlineForm">
                <input name="id" type="hidden" value={message.id} />
                <SelectField name="status" value={message.status} values={data.enums.supportStatuses} />
                <button type="submit">Обновить статус</button>
              </form>
            </article>
          ))}
        </div>
      </section>
      <section className="adminPanel">
        <div className="panelHeader"><div><span className="eyebrow">Complaints</span><h2>Разбор споров</h2></div></div>
        <div className="adminCardGrid">
          {data.complaints.map((complaint) => (
            <article className="adminEditCard" key={complaint.id}>
              <header>
                <strong>{complaint.exchange.name} · {complaint.type}</strong>
                <small>{statusLabel(complaint.status)} · {formatAdminDate(complaint.createdAt)}</small>
              </header>
              <p>{complaint.message}</p>
              {complaint.moderatorNote && <small>Комментарий: {complaint.moderatorNote}</small>}
              <form action={updateComplaintStatusAction} className="adminInlineForm">
                <input name="id" type="hidden" value={complaint.id} />
                <SelectField name="status" value={complaint.status} values={data.enums.complaintStatuses} />
                <input name="message" placeholder="Комментарий модератора" />
                <button type="submit">Обновить жалобу</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function AuditSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  return (
    <section className="adminPanel">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Раздел 7</span>
          <h2>Аудит</h2>
          <p>Последние действия сотрудников и системные изменения.</p>
        </div>
      </div>
      <div className="adminAuditList">
        {data.auditLogs.map((log) => (
          <article key={log.id}>
            <strong>{log.action}</strong>
            <span>{log.actor} · {log.targetType}{log.targetId ? `: ${log.targetId}` : ""}</span>
            {log.details && <small>{log.details}</small>}
            <time>{formatAdminDate(log.createdAt)}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function UsersSection({ data }: { data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  return (
    <>
      <section className="adminPanel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">Раздел 8</span>
            <h2>Управление пользователями</h2>
            <p>Создание, редактирование ролей и привязка владельцев к обменникам.</p>
          </div>
        </div>

        <details className="adminDetails">
          <summary>Создать пользователя</summary>
          <form action={saveUserAction} className="adminFormGrid">
            <input name="name" placeholder="Имя" />
            <input name="email" type="email" placeholder="email@example.com" required />
            <input name="password" type="password" placeholder="Пароль" required />

            <select name="role" defaultValue="OWNER" style={{
              background: "#1a1917",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: "6px",
              fontSize: "13px"
            }}>
              <option value="USER">Пользователь (USER)</option>
              <option value="OWNER">Владелец обменника (OWNER)</option>
              <option value="ADMIN">Администратор (ADMIN)</option>
            </select>

            <select name="exchangeId" defaultValue="" style={{
              background: "#1a1917",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: "6px",
              fontSize: "13px"
            }}>
              <option value="">-- Выберите обменник (для OWNER) --</option>
              {data.exchanges.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name} ({ex.domain})</option>
              ))}
            </select>

            <button type="submit">Создать пользователя</button>
          </form>
        </details>

        <div className="adminTable">
          <div className="directoryHead" role="row" style={{ gridTemplateColumns: "1.2fr 1.5fr 0.8fr 1.5fr 1.2fr auto" }}>
            <span>Имя</span>
            <span>Email</span>
            <span>Роль</span>
            <span>Привязанный обменник</span>
            <span>Новый пароль</span>
            <span>Действие</span>
          </div>

          {data.dbUsers.map((user) => (
            <form action={saveUserAction} key={user.id} className="directoryRow" role="row" style={{ gridTemplateColumns: "1.2fr 1.5fr 0.8fr 1.5fr 1.2fr auto", gap: "12px", alignItems: "center", display: "grid", background: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 0" }}>
              <input name="id" type="hidden" value={user.id} />
              <input name="name" defaultValue={user.name ?? ""} placeholder="Имя" style={{ margin: 0 }} />
              <input name="email" defaultValue={user.email ?? ""} placeholder="Email" type="email" style={{ margin: 0 }} />

              <select name="role" defaultValue={user.role} style={{
                background: "#1a1917",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                margin: 0
              }}>
                <option value="USER">USER</option>
                <option value="OWNER">OWNER</option>
                <option value="ADMIN">ADMIN</option>
              </select>

              <select name="exchangeId" defaultValue={user.exchangeId ?? ""} style={{
                background: "#1a1917",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                margin: 0
              }}>
                <option value="">-- Нет привязки --</option>
                {data.exchanges.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>

              <input name="password" type="password" placeholder="Новый пароль" style={{ margin: 0 }} />

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={{ padding: "6px 12px", fontSize: "12px" }}>Сохранить</button>
                <DeleteButton action={deleteUserAction} id={user.id} label={user.email ?? "пользователя"} />
              </div>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}

function AdminSectionView({ section, data }: { section: AdminSection; data: Awaited<ReturnType<typeof loadAdminConsole>> }) {
  if (section === "exchanges") return <ExchangesSection data={data} />;
  if (section === "assets") return <AssetsSection data={data} />;
  if (section === "content") return <ContentSection data={data} />;
  if (section === "links") return <LinksSection data={data} />;
  if (section === "support") return <SupportSection data={data} />;
  if (section === "audit") return <AuditSection data={data} />;
  if (section === "users") return <UsersSection data={data} />;
  return <ModerationSection data={data} />;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAuthRole(["ADMIN"], "/admin");
  const params = await searchParams;
  const section = parseAdminSection(params.section);
  const data = await loadAdminConsole(section, {
    exchangePage: positivePage(params.page),
    exchangeQuery: firstParam(params.q)
  });

  return (
    <AppShell footer>
      <section className="dashboardPage adminConsole">
        <div className="dashboardTitle">
          <div>
            <span className="eyebrow">Администрирование</span>
            <h1>Центр управления</h1>
            <p>Разделы для модерации, обменников, контента, валют, API, обращений и аудита платформы.</p>
          </div>
          <Link className="loginButton" href="/dashboard/owner">Кабинет владельца</Link>
        </div>

        <div className="adminMetrics">
          <div><strong>{data.counts.users}</strong><span>пользователей</span></div>
          <div><strong>{data.counts.exchanges}</strong><span>обменников</span></div>
          <div><strong>{data.counts.assets}</strong><span>валют</span></div>
          <div><strong>{data.counts.activeComplaints}</strong><span>активных жалоб</span></div>
          <div><strong>{data.counts.pendingReviews}</strong><span>отзывов на проверке</span></div>
        </div>

        <AdminNav active={section} counts={data.counts} />

        <div className="adminWorkspace">
          {params.error && (
            <div className="adminErrorBanner" style={{
              padding: "12px 16px",
              background: "rgba(224, 49, 49, 0.08)",
              border: "1px solid rgba(224, 49, 49, 0.25)",
              borderRadius: "8px",
              color: "#e03131",
              fontSize: "12px",
              fontWeight: 500,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px"
            }}>
              <span><strong>Ошибка:</strong> {decodeURIComponent(firstParam(params.error) ?? "")}</span>
              <Link href={`/admin${section === "moderation" ? "" : `?section=${section}`}`} style={{ color: "#e03131", fontWeight: "bold", textDecoration: "none", fontSize: "14px" }}>✕</Link>
            </div>
          )}
          <AdBanner placement="dashboard-top" />
          <AdminSectionView section={section} data={data} />
        </div>
      </section>
    </AppShell>
  );
}
