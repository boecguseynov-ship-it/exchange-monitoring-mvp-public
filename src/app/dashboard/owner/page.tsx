import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Кабинет обменника — RateScope"
};

export default function OwnerDashboardPage() {
  return (
    <AppShell footer>
      <section className="dashboardPage">
        <div className="dashboardTitle">
          <div>
            <span className="eyebrow">Owner dashboard</span>
            <h1>Кабинет обменника</h1>
            <p>Раздел готов к подключению постоянной авторизации и базы заявок.</p>
          </div>
          <Link className="loginButton" href="/contacts">Связаться</Link>
        </div>
        <div className="docsCode" id="profile">
          <div>
            <h2>Профиль и фиды</h2>
            <p>После включения входа здесь будут настройки профиля, API-ключи, фиды, отзывы и обращения.</p>
          </div>
          <pre>{`status: prepared
auth: pending
feeds: ready`}</pre>
        </div>
      </section>
    </AppShell>
  );
}
