import Link from "next/link";
import { BookOpen, Search, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { wikiGroups } from "@/features/public-content/content";
import { contactSocialLinkGroup } from "@/lib/site-links";
import { loadPublicWikiEntries } from "@/lib/wiki-entries";

const icons = {
  users: Users,
  exchange: ShieldCheck,
  reference: BookOpen
};

export const metadata = {
  title: "База знаний — monik exchange"
};

export const dynamic = "force-dynamic";

function iconKey(value: string) {
  return value in icons ? value as keyof typeof icons : "reference";
}

export default async function WikiPage() {
  const storedEntries = await loadPublicWikiEntries({ publishedOnly: true }).catch(() => []);
  const wikiEntries = storedEntries.filter((entry) => entry.group !== contactSocialLinkGroup);
  const groups = wikiEntries.length
    ? Array.from(new Set(wikiEntries.map((entry) => entry.group))).map((groupTitle) => {
      const entries = wikiEntries.filter((entry) => entry.group === groupTitle);
      return {
        title: groupTitle,
        icon: iconKey(entries[0]?.icon ?? "reference"),
        items: entries.map((entry) => ({
          title: entry.title,
          description: entry.description,
          href: entry.href,
          anchor: entry.anchor
        }))
      };
    })
    : wikiGroups;
  const visibleGroups = groups.map((group) => (
    group.title === "Справочники" && !group.items.some((item) => item.title === "KYC/AML сигналы")
      ? {
        ...group,
        items: [
          ...group.items,
          {
            title: "KYC/AML сигналы",
            description: "Как читать KYC/AML-метки и условия проверки внутри monik exchange.",
            href: "/wiki#legend",
            anchor: "legend"
          }
        ]
      }
      : group
  ));

  return (
    <AppShell footer>
      <section className="publicPage wikiPage">
        <header className="wikiHero">
          <span className="eyebrow">Wiki</span>
          <h1>База знаний <span>monik exchange</span></h1>
          <p>
            Справочник для пользователей и обменных пунктов: как читать курс,
            резерв, лимиты, KYC-метки и публичные профили.
          </p>
        </header>
        <div className="contentSearch wikiSearch">
          <Search size={16} />
          <input placeholder="Поиск по базе знаний" disabled />
        </div>
        <div className="wikiGrid">
          {visibleGroups.map((group) => {
            const Icon = icons[iconKey(group.icon)];
            return (
              <section className="wikiGroup" key={group.title}>
                <div className="wikiGroupTitle">
                  <div>
                    <h2>{group.title}</h2>
                  </div>
                  <span><Icon size={17} /></span>
                </div>
                <div className="wikiLinks">
                  {group.items.map((item) => {
                    const content = (
                      <>
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                      </>
                    );
                    return item.href.startsWith("http") ? (
                      <a
                        href={item.href}
                        id={item.anchor ?? undefined}
                        key={`${group.title}-${item.title}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {content}
                      </a>
                    ) : (
                      <Link href={item.href} id={item.anchor ?? undefined} key={`${group.title}-${item.title}`}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
