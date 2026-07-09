import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell footer>
      <section className="publicPage">
        <span className="eyebrow">404</span>
        <h1>Страница не найдена</h1>
        <p className="publicLead">
          Адрес мог измениться. Вернитесь на главную или откройте каталог обменников.
        </p>
        <div className="quickDirectionGrid">
          <Link href="/">Главная</Link>
          <Link href="/exchangers">Каталог обменников</Link>
          <Link href="/contacts">Контакты</Link>
        </div>
      </section>
    </AppShell>
  );
}
