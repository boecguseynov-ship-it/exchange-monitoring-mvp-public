import Link from "next/link";
import { BookOpen, Search, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { wikiGroups } from "@/features/public-content/content";

const icons = {
  users: Users,
  exchange: ShieldCheck,
  reference: BookOpen
};

export const metadata = {
  title: "База знаний — RateScope"
};

export default function WikiPage() {
  return (
    <AppShell footer>
      <section className="publicPage wikiPage">
        <header className="wikiHero">
          <span className="eyebrow">Wiki</span>
          <h1>База знаний <span>RateScope</span></h1>
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
          {wikiGroups.map((group) => {
            const Icon = icons[group.icon];
            return (
              <section className="wikiGroup" key={group.title}>
                <div className="wikiGroupTitle">
                  <div>
                    <h2>{group.title}</h2>
                  </div>
                  <span><Icon size={17} /></span>
                </div>
                <div className="wikiLinks">
                  {group.items.map((item) => (
                    <Link href={item.href} id={item.anchor ?? undefined} key={`${group.title}-${item.title}`}>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
