import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Вход — RateScope"
};

export default function LoginPage() {
  return (
    <AppShell footer>
      <section className="authPage">
        <div className="authIntro">
          <span className="eyebrow">RateScope ID</span>
          <h1>Вход в личный кабинет</h1>
          <p>
            Кабинет нужен обменным пунктам для профиля, фидов, отзывов и обращений.
            Публичный мониторинг работает без регистрации.
          </p>
        </div>
        <div className="authCard">
          <h2>Демо-вход временно отключен</h2>
          <p className="publicLead">
            Авторизация появится после подключения постоянной базы и провайдера входа.
            Сейчас можно пользоваться мониторингом, каталогом и публичными страницами.
          </p>
          <form className="loginForm">
            <label>
              Email
              <input type="email" placeholder="owner@example.com" disabled />
            </label>
            <label>
              Пароль
              <input type="password" placeholder="••••••••" disabled />
            </label>
            <button type="button" disabled>Войти</button>
          </form>
          <p className="publicLead">
            Для связи по профилю обменника: <Link href="/contacts">контакты</Link>.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
