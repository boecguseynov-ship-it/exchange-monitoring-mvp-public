import Link from "next/link";
import { Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getContactSocialLinks } from "@/lib/site-links";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Контакты — RateScope"
};

export default async function ContactsPage() {
  const links = await getContactSocialLinks();

  return (
    <AppShell footer>
      <section className="contactsPage publicPage">
        <header className="contactsHeader">
          <span className="headerBadge"><ShieldCheck size={14} />Поддержка RateScope</span>
          <h1>Контакты и обратная связь</h1>
          <p className="lead">
            Напишите по вопросам профиля обменника, отзывов, жалоб, партнерства
            или технической интеграции.
          </p>
        </header>
        <div className="contactsLayout">
          <aside className="contactsSidebar">
            <section className="contactsSidebarSection">
              <div className="sectionTitle">
                <h2>Каналы связи</h2>
                <p>Выберите удобный способ обращения.</p>
              </div>
              {links.map((link) => (
                link.href.startsWith("/") ? (
                  <Link href={link.href} key={link.key}>{link.label}</Link>
                ) : (
                  <a href={link.href} key={link.key} rel="noreferrer" target="_blank">{link.label}</a>
                )
              ))}
            </section>
            <section className="contactsSidebarSection">
              <div className="sectionTitle">
                <h2>Что приложить</h2>
                <p>Ссылку на обменник, направление, сумму, номер заявки и скрин условий.</p>
              </div>
            </section>
          </aside>
          <section className="contactsFormSection" id="feedback">
            <span className="eyebrow">Feedback</span>
            <h2>Форма обращения</h2>
            <p className="publicLead">
              Сейчас форма работает как публичный шаблон. Для срочного вопроса используйте email или Telegram.
            </p>
            <form className="contactFormNew">
              <label>
                Email
                <input placeholder="you@example.com" disabled />
              </label>
              <label>
                Тема
                <input placeholder="Профиль обменника / отзыв / интеграция" disabled />
              </label>
              <label>
                Сообщение
                <textarea placeholder="Опишите ситуацию" disabled />
              </label>
              <button type="button" disabled>Отправить</button>
            </form>
            <p className="publicLead">
              <Mail size={14} /> support@ratescope.local · <Send size={14} /> Telegram · <MessageCircle size={14} /> Блог
            </p>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
