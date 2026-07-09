import Link from "next/link";
import { Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContactForm } from "@/components/contact-form";
import { getContactSocialLinks } from "@/lib/site-links";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Контакты — monik exchange",
};

export default async function ContactsPage() {
  const links = await getContactSocialLinks();

  return (
    <AppShell footer>
      <section className="contactsPage publicPage">
        <header className="contactsHeader">
          <span className="headerBadge"><ShieldCheck size={14} />Поддержка monik exchange</span>
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
              Заполните форму ниже. Сообщение будет отправлено в службу поддержки.
            </p>
            <ContactForm />
            <div className="contactsSocialLinks">
              <a href="mailto:support@monik.exchange" className="contactsSocialLink">
                <Mail size={14} /> support@monik.exchange
              </a>
              <a href="https://t.me/" target="_blank" rel="noreferrer" className="contactsSocialLink">
                <Send size={14} /> Telegram
              </a>
              <Link href="/blog" className="contactsSocialLink">
                <MessageCircle size={14} /> Блог
              </Link>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
