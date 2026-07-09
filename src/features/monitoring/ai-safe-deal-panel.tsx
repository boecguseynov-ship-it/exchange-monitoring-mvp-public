"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ClipboardCheck,
  Copy,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  Target,
  Zap
} from "lucide-react";
import {
  analyzeSafeDeal,
  type SafeDealOffer,
  type SafeDealProfile,
  type SafeDealRiskSeverity
} from "./ai-safe-deal";
import { currencyDisplayMeta } from "@/components/currency-icon";

type AssistantMode = SafeDealProfile | "support";

type RateScopeAiState = {
  key: string;
  loading: boolean;
  content: string;
  provider: string;
  error: string;
};

type RateScopeAiRequest = {
  analysis: NonNullable<ReturnType<typeof analyzeSafeDeal>>;
  assistantMode: SafeDealProfile;
  amount: number;
  from: string;
  to: string;
};

const assistantModes: Array<{
  mode: AssistantMode;
  label: string;
  icon: typeof Sparkles;
}> = [
  { mode: "balanced", label: "Баланс", icon: Sparkles },
  { mode: "value", label: "Выгода", icon: Zap },
  { mode: "safety", label: "Безопасно", icon: ShieldCheck },
  { mode: "support", label: "Если зависнет", icon: MessageSquareWarning }
];

function formatCurrencyCode(code: string) {
  const { displayCode, network } = currencyDisplayMeta(code);
  return network ? `${displayCode} ${network}` : displayCode;
}

function formatDealAmount(value: number, code: string) {
  return `${value.toLocaleString("ru-RU", {
    maximumFractionDigits: value >= 100 ? 2 : 6
  })} ${formatCurrencyCode(code)}`;
}

function riskTone(score: number) {
  if (score >= 82) return "good";
  if (score >= 68) return "watch";
  return "risk";
}

function riskLabel(severity: SafeDealRiskSeverity) {
  if (severity === "high") return "Важно";
  if (severity === "medium") return "Проверить";
  return "Учесть";
}

function buildRateScopeAiPayload({
  analysis,
  assistantMode,
  amount,
  from,
  to
}: {
  analysis: NonNullable<ReturnType<typeof analyzeSafeDeal>>;
  assistantMode: SafeDealProfile;
  amount: number;
  from: string;
  to: string;
}) {
  const compactOffer = (item: typeof analysis.recommended, index?: number) => ({
    rank: typeof index === "number" ? index + 1 : undefined,
    exchange: item.offer.exchange.name,
    rating: item.offer.exchange.rating,
    reviews: item.offer.exchange.reviews,
    rate: item.offer.rate,
    score: item.score,
    securityScore: item.securityScore,
    receivedAmount: item.offer.receivedAmount,
    reserve: item.offer.reserve,
    minAmount: item.offer.minAmount,
    maxAmount: item.offer.maxAmount,
    kyc: item.offer.kyc,
    processing: item.offer.processing,
    marks: item.offer.marks,
    valueLossPercent: item.valueLossPercent,
    reserveCoverage: item.reserveCoverage,
    reasons: item.reasons,
    risks: item.risks
  });

  const compactCandidate = (item: typeof analysis.recommended, index: number) => ({
    rank: index + 1,
    exchange: item.offer.exchange.name,
    rating: item.offer.exchange.rating,
    reviews: item.offer.exchange.reviews,
    score: item.score,
    securityScore: item.securityScore,
    receivedAmount: item.offer.receivedAmount,
    reserveCoverage: item.reserveCoverage,
    valueLossPercent: item.valueLossPercent,
    kyc: item.offer.kyc,
    processing: item.offer.processing
  });

  return {
    mode: assistantMode,
    amount,
    from,
    to,
    recommended: compactOffer(analysis.recommended),
    bestValue: compactOffer(analysis.bestValue),
    safest: compactOffer(analysis.safest),
    analyzedOffers: analysis.offers.slice(0, 18).map(compactCandidate),
    analyzedOffersCount: analysis.offers.length,
    warnings: analysis.warnings,
    checklist: analysis.checklist
  };
}

export function AISafeDealPanel({
  offers,
  amount,
  from,
  to,
  loading,
  providerError
}: {
  offers: SafeDealOffer[];
  amount: number;
  from: string;
  to: string;
  loading: boolean;
  providerError?: string;
}) {
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("balanced");
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const [rateScopeAi, setRateScopeAi] = useState<RateScopeAiState>({
    key: "",
    loading: false,
    content: "",
    provider: "",
    error: ""
  });
  const rateScopeAiCache = useRef<Map<string, RateScopeAiState>>(new Map());
  const pendingRateScopeAiKeys = useRef<Set<string>>(new Set());
  const latestRateScopeAiRequest = useRef<RateScopeAiRequest | null>(null);
  const activeProfile: SafeDealProfile = assistantMode === "support" ? "balanced" : assistantMode;
  const analysis = useMemo(
    () => analyzeSafeDeal({ offers, amount, from, to, profile: activeProfile }),
    [activeProfile, amount, from, offers, to]
  );
  const rateScopeAiKey = analysis && assistantMode !== "support"
    ? `${assistantMode}:${from}:${to}:${amount}:${analysis.recommended.offer.id}:${analysis.recommended.score}`
    : "";
  useEffect(() => {
    latestRateScopeAiRequest.current = analysis && assistantMode !== "support"
      ? { analysis, assistantMode, amount, from, to }
      : null;
  }, [analysis, amount, assistantMode, from, to]);

  useEffect(() => {
    if (!rateScopeAiKey) return;
    const request = latestRateScopeAiRequest.current;
    if (!request) return;
    const cache = rateScopeAiCache.current;
    const pendingKeys = pendingRateScopeAiKeys.current;

    const cached = cache.get(rateScopeAiKey);
    if (cached) {
      setRateScopeAi((current) => (
        current.key === cached.key &&
        current.content === cached.content &&
        current.error === cached.error
          ? current
          : cached
      ));
      return;
    }

    if (pendingKeys.has(rateScopeAiKey)) return;
    pendingKeys.add(rateScopeAiKey);

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        setRateScopeAi({ key: rateScopeAiKey, loading: true, content: "", provider: "", error: "" });
        const response = await fetch("/api/v1/safe-deal-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildRateScopeAiPayload({
            analysis: request.analysis,
            assistantMode: request.assistantMode,
            amount: request.amount,
            from: request.from,
            to: request.to
          })),
          cache: "no-store",
          signal: controller.signal
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "monik exchange AI временно недоступен");
        }
        const next = {
          key: rateScopeAiKey,
          loading: false,
          content: String(payload.content ?? ""),
          provider: String(payload.provider ?? ""),
          error: ""
        };
        cache.set(rateScopeAiKey, next);
        setRateScopeAi(next);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const next = {
          key: rateScopeAiKey,
          loading: false,
          content: "",
          provider: "",
          error: error instanceof Error ? error.message : "monik exchange AI временно недоступен"
        };
        cache.set(rateScopeAiKey, next);
        setRateScopeAi(next);
      } finally {
        pendingKeys.delete(rateScopeAiKey);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      pendingKeys.delete(rateScopeAiKey);
    };
  }, [rateScopeAiKey]);

  const toggleStep = (index: number) => {
    setCheckedSteps((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const copySupportTemplate = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis.supportTemplate);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="safeDealPanel" aria-label="AI SafeDeal">
      <header className="safeDealHeader">
        <span className="safeDealAvatar" aria-hidden="true">
          <Bot size={18} />
        </span>
        <div>
          <h2>AI SafeDeal</h2>
          <p>Ассистент проверяет курс, резерв, отзывы и красные флаги перед переходом к обменнику.</p>
        </div>
        {analysis ? (
          <strong className={`safeDealScore ${riskTone(analysis.recommended.securityScore)}`}>
            {analysis.recommended.score}/100
          </strong>
        ) : (
          <strong className="safeDealScore idle">жду данные</strong>
        )}
      </header>

      <div className="safeDealModes" aria-label="Режим AI SafeDeal">
        {assistantModes.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-pressed={assistantMode === item.mode}
              key={item.mode}
              onClick={() => setAssistantMode(item.mode)}
              type="button"
            >
              <Icon size={13} />
              {item.label}
            </button>
          );
        })}
      </div>

      {!analysis && (
        <div className="safeDealEmpty">
          <AlertTriangle size={18} />
          <span>
            {loading
              ? "Сравниваю live-предложения и собираю безопасный маршрут сделки."
              : providerError ?? "Выберите направление и сумму, чтобы ассистент разобрал сделку."}
          </span>
        </div>
      )}

      {analysis && assistantMode !== "support" && (
        <div className="safeDealBody">
          <div className="safeDealVerdict">
            <small>{formatDealAmount(amount, from)} → {formatCurrencyCode(to)}</small>
            <h3>{analysis.headline}</h3>
            <p>{analysis.summary}</p>
          </div>

          <div className="safeDealStats">
            <span>
              <small>Получите</small>
              <strong>{formatDealAmount(analysis.recommended.offer.receivedAmount, to)}</strong>
            </span>
            <span>
              <small>К максимуму</small>
              <strong>
                {analysis.recommended.valueLossAmount > 0
                  ? `-${formatDealAmount(analysis.recommended.valueLossAmount, to)}`
                  : "лучший курс"}
              </strong>
            </span>
            <span>
              <small>Резерв</small>
              <strong>{analysis.recommended.reserveCoverage.toFixed(1)}x</strong>
            </span>
            <span>
              <small>Разброс выдачи</small>
              <strong>{analysis.spreadPercent.toFixed(2)}%</strong>
            </span>
          </div>

          <details className="safeDealDisclosure">
            <summary>
              <span>Подробности SafeDeal</span>
              <small>AI-объяснение, риски и чеклист</small>
            </summary>

            <div className="safeDealDisclosureBody">
              <div className={rateScopeAi.content ? "safeDealAiAnswer ready" : "safeDealAiAnswer"}>
                <span><Sparkles size={13} /> monik exchange AI</span>
                {rateScopeAi.loading && <p>monik exchange готовит живое объяснение...</p>}
                {!rateScopeAi.loading && rateScopeAi.content && <p>{rateScopeAi.content}</p>}
                {!rateScopeAi.loading && !rateScopeAi.content && rateScopeAi.error && (
                  <p>monik exchange AI сейчас не ответил, ниже показан локальный анализ SafeDeal.</p>
                )}
              </div>

              <div className="safeDealGrid">
                <div className="safeDealReasons">
                  <h4><Target size={13} /> Почему этот вариант</h4>
                  <ul>
                    {analysis.recommended.reasons.length ? (
                      analysis.recommended.reasons.map((reason) => <li key={reason}>{reason}</li>)
                    ) : (
                      <li>лучший доступный баланс по текущей выдаче</li>
                    )}
                  </ul>
                </div>

                <div className="safeDealRisks">
                  <h4><AlertTriangle size={13} /> Что проверить</h4>
                  <ul>
                    {(analysis.recommended.risks.length ? analysis.recommended.risks : analysis.warnings).slice(0, 3).map((risk) => (
                      <li className={risk.severity} key={risk.text}>
                        <b>{riskLabel(risk.severity)}</b>
                        <span>{risk.text}</span>
                      </li>
                    ))}
                    {!analysis.recommended.risks.length && !analysis.warnings.length && (
                      <li className="low">
                        <b>Ок</b>
                        <span>критичных красных флагов по текущим данным не видно</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="safeDealChecklist">
                <h4><ClipboardCheck size={13} /> Чеклист перед оплатой</h4>
                <div>
                  {analysis.checklist.map((step, index) => (
                    <button
                      className={checkedSteps.has(index) ? "checked" : undefined}
                      key={step}
                      onClick={() => toggleStep(index)}
                      type="button"
                    >
                      <span>{checkedSteps.has(index) && <Check size={11} />}</span>
                      {step}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
      )}

      {analysis && assistantMode === "support" && (
        <div className="safeDealSupport">
          <div>
            <small>Если обмен задержался</small>
            <h3>Соберите доказательства до спора</h3>
            <p>Сохраните номер заявки, чек оплаты, txid или банковскую квитанцию. Если обычное время обработки прошло, отправьте обменнику короткое обращение.</p>
          </div>
          <pre>{analysis.supportTemplate}</pre>
          <button type="button" onClick={copySupportTemplate}>
            <Copy size={13} />
            {copied ? "Скопировано" : "Скопировать текст"}
          </button>
        </div>
      )}
    </section>
  );
}
