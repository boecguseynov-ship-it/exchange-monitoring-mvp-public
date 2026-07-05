import Link from "next/link";
import {
  Github,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Star,
  TrendingUp,
  type LucideIcon
} from "lucide-react";
import { Logo } from "./logo";
import { getFooterWikiLinks } from "@/lib/footer-wiki-links";
import { getContactSocialLinks, type ContactSocialLink } from "@/lib/site-links";

const reputationLinks = ["Отзывы", "Маркетинг"];

const trustBadges = [
  { icon: <ShieldCheck size={18} />, title: "AML-контроль", text: "метки риска" },
  { icon: <TrendingUp size={18} />, title: "Онлайн-курсы", text: "обновление рынка" },
  { icon: <Star size={18} />, title: "Репутация", text: "отзывы и жалобы" }
];

const socialIcons: Record<ContactSocialLink["icon"], LucideIcon> = {
  mail: Mail,
  telegram: Send,
  blog: MessageCircle,
  github: Github
};

function FooterSocialLink({ link }: { link: ContactSocialLink }) {
  const Icon = socialIcons[link.icon];
  const content = <Icon size={17} />;

  if (link.href.startsWith("/")) {
    return <Link href={link.href} aria-label={link.label}>{content}</Link>;
  }

  return <a href={link.href} aria-label={link.label} rel="noopener noreferrer" target="_blank">{content}</a>;
}

export async function SiteFooter() {
  const [socialLinks, footerGroups] = await Promise.all([getContactSocialLinks(), getFooterWikiLinks()]);

  return (
    <footer className="siteFooter">
      <div className="footerInner">
        <div className="footerTop">
          <div className="footerLinks">
            {footerGroups.map((group) => (
              <section key={group.title}>
                <h2>{group.title}</h2>
                {group.items.map((item) => <Link href={item.href} key={item.anchor ?? item.title}>{item.title}</Link>)}
              </section>
            ))}
          </div>

          <div className="footerSide">
            <div className="footerSocials" aria-label="Социальные каналы">
              {socialLinks.map((link) => <FooterSocialLink key={link.key} link={link} />)}
            </div>

            <section className="footerTrust" aria-label="Доверие к мониторингу">
              <h2>Наши проверки</h2>
              <div>
                {trustBadges.map((badge) => (
                  <span key={badge.title}>
                    {badge.icon}
                    <strong>{badge.title}</strong>
                    <small>{badge.text}</small>
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="footerBottom">
          <div className="footerBrand">
            <Logo />
            <span>Знаем, где обменять. © 2026 RateScope</span>
          </div>
          <nav aria-label="Документы">
            <Link href="/privacy">Политика конфиденциальности</Link>
            <Link href="/terms">Условия использования</Link>
          </nav>
          <nav aria-label="Репутационные площадки">
            {reputationLinks.map((label) => <Link href="/contacts" key={label}>{label}</Link>)}
          </nav>
        </div>
      </div>
    </footer>
  );
}
