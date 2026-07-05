import Link from "next/link";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { loadLiveExchangeDirectory } from "@/lib/bestchange/service";
import { localChangers } from "@/lib/bestchange/local";
import { normalizeBestChangeDirectory } from "@/lib/bestchange/normalize";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Обменные пункты — RateScope"
};

async function loadDirectory() {
  try {
    return await loadLiveExchangeDirectory();
  } catch {
    return normalizeBestChangeDirectory(localChangers, new Map());
  }
}

export default async function ExchangersPage() {
  const exchangers = await loadDirectory();

  return (
    <AppShell footer>
      <section className="publicPage exchangeProfilePage">
        <span className="eyebrow">Каталог</span>
        <h1>Обменные пункты</h1>
        <p className="publicLead">
          Публичный каталог обменников с резервами, статусом, рейтингом и быстрым переходом к профилю.
        </p>
        <div className="exchangeCards" id="catalog">
          {exchangers.slice(0, 60).map((exchange) => (
            <Link href={`/exchangers/${exchange.slug}`} key={exchange.slug}>
              <span className="exchangeName">
                <i>{exchange.name.slice(0, 1).toUpperCase()}</i>
              </span>
              <span>
                <h2>{exchange.name}</h2>
                <p>{exchange.domain} · резерв {exchange.reserve.toLocaleString("ru-RU")}</p>
                <small><BadgeCheck size={12} /> {exchange.verified ? "Проверен" : "Наблюдение"}</small>
              </span>
              <span className="cardRating">
                <strong>{exchange.rating?.toFixed(1) ?? "—"}</strong>
                <small><Star size={12} fill="currentColor" /> {exchange.reviews}</small>
                <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
