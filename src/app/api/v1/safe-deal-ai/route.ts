import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SafeDealPayload = {
  mode?: string;
  amount?: number;
  from?: string;
  to?: string;
  recommended?: {
    exchange?: string;
    score?: number;
    securityScore?: number;
    receivedAmount?: number;
    reserveCoverage?: number;
    valueLossPercent?: number;
    reasons?: string[];
  };
  warnings?: Array<{ severity?: string; text?: string }>;
};

function formatNumber(value: unknown, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("ru-RU", { maximumFractionDigits: digits }) : "0";
}

export async function POST(request: NextRequest) {
  let payload: SafeDealPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({
      ok: false,
      provider: "Local SafeDeal",
      error: "Некорректный запрос"
    });
  }

  const recommended = payload.recommended;
  if (!recommended?.exchange) {
    return NextResponse.json({
      ok: false,
      provider: "Local SafeDeal",
      error: "Недостаточно данных для анализа"
    });
  }

  const reasons = recommended.reasons?.length
    ? ` Сильные стороны: ${recommended.reasons.slice(0, 3).join(", ")}.`
    : "";
  const warnings = payload.warnings?.length
    ? ` Перед оплатой проверьте: ${payload.warnings.slice(0, 2).map((item) => item.text).filter(Boolean).join("; ")}.`
    : " Критичных предупреждений по текущей выборке нет.";
  const loss = Number(recommended.valueLossPercent ?? 0);
  const lossText = loss > 0.01
    ? `Компромисс к лучшему курсу около ${formatNumber(loss)}%.`
    : "Это также один из лучших вариантов по сумме к получению.";

  return NextResponse.json({
    ok: true,
    provider: "Local SafeDeal",
    content: `Рекомендую ${recommended.exchange}: общий скор ${formatNumber(recommended.score, 0)}/100, безопасность ${formatNumber(recommended.securityScore, 0)}/100, резерв покрывает сделку примерно в ${formatNumber(recommended.reserveCoverage)}x. ${lossText}${reasons}${warnings}`
  });
}
