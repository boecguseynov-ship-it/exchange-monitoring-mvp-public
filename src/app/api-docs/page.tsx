import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "API — RateScope"
};

const endpoints = [
  { method: "GET", path: "/api/v1/assets", text: "Список валют и сетей" },
  { method: "GET", path: "/live-offers?from=RUB&to=USDTTRC20&amount=111", text: "Публичные предложения обмена" },
  { method: "GET", path: "/api/v1/insights", text: "Рынок, отзывы и статус мониторинга" },
  { method: "POST", path: "/api/v1/safe-deal-ai", text: "Локальное объяснение SafeDeal" }
];

export default function ApiDocsPage() {
  return (
    <AppShell footer>
      <section className="docsPage">
        <span className="eyebrow">API</span>
        <h1>Документация RateScope API</h1>
        <p className="docsLead">
          Публичные endpoints для витрины мониторинга. Ответы возвращаются в JSON и не требуют авторизации.
        </p>
        <div className="endpointList">
          {endpoints.map((endpoint) => (
            <div key={endpoint.path}>
              <strong>{endpoint.method}</strong>
              <code>{endpoint.path}</code>
              <span>{endpoint.text}</span>
            </div>
          ))}
        </div>
        <div className="docsCode">
          <div>
            <span className="eyebrow">Example</span>
            <h2>Запрос предложений</h2>
            <p>Используйте коды валют из `/api/v1/assets`.</p>
          </div>
          <pre>{`fetch("/live-offers?from=RUB&to=USDTTRC20&amount=111")
  .then((response) => response.json())
  .then((payload) => console.log(payload.data));`}</pre>
        </div>
      </section>
    </AppShell>
  );
}
