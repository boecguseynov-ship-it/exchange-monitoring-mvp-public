import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { loginAction } from "@/lib/auth-actions";
import { authAccountsReady } from "@/lib/auth";

export const metadata = {
  title: "Вход - monik exchange"
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = firstParam(params.error);
  const next = firstParam(params.next) || "/dashboard";
  const accountsReady = authAccountsReady();

  return (
    <AppShell footer>
      <section className="authPage">
        <div className="authIntro">
          <span className="eyebrow">monik exchange ID</span>
          <h1>Вход в личный кабинет</h1>
          <p>
            Админка, кабинет владельца и личный кабинет открываются только после авторизации.
            Публичный мониторинг, каталог обменников и статьи остаются доступными всем.
          </p>
        </div>
        <div className="authCard">
          <h2>Вход в monik exchange</h2>
          {!accountsReady && (
            <p className="authAlert">
              Аккаунты еще не настроены. Добавьте в .env пароли для RATESCOPE_ADMIN_PASSWORD и RATESCOPE_OWNER_PASSWORD.
            </p>
          )}
          {error === "invalid" && <p className="authAlert">Неверный email или пароль.</p>}
          {error === "forbidden" && <p className="authAlert">У этого аккаунта нет доступа к выбранному разделу.</p>}
          <form action={loginAction} className="loginForm">
            <input name="next" type="hidden" value={next} />
            <label>
              Email
              <input name="email" autoComplete="email" type="email" placeholder="admin@monik.exchange" required />
            </label>
            <label>
              Пароль
              <input name="password" autoComplete="current-password" type="password" placeholder="Введите пароль" required />
            </label>
            <button type="submit" disabled={!accountsReady}>Войти</button>
          </form>
          <p className="publicLead">
            Для подключения обменника или восстановления доступа напишите через <Link href="/contacts">контакты</Link>.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
