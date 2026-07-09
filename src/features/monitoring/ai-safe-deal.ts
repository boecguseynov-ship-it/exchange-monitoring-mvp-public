import { assessOfferSecurity } from "./security-score";

export type SafeDealProfile = "balanced" | "value" | "safety";

export type SafeDealRiskSeverity = "high" | "medium" | "low";

export type SafeDealOffer = {
  id: string;
  exchange: {
    name: string;
    slug: string;
    isDemo: boolean;
    rating: number | null;
    reviews: number;
    url: string;
  };
  rate: number;
  receivedAmount: number;
  reserve: number;
  minAmount: number;
  maxAmount: number;
  kyc: string;
  processing: string;
  marks: string[];
  updatedAt: string;
};

export type SafeDealRisk = {
  severity: SafeDealRiskSeverity;
  text: string;
};

export type SafeDealScoredOffer = {
  offer: SafeDealOffer;
  score: number;
  securityScore: number;
  reserveCoverage: number;
  valueLossAmount: number;
  valueLossPercent: number;
  risks: SafeDealRisk[];
  reasons: string[];
};

export type SafeDealAnalysis = {
  profile: SafeDealProfile;
  offers: SafeDealScoredOffer[];
  recommended: SafeDealScoredOffer;
  bestValue: SafeDealScoredOffer;
  safest: SafeDealScoredOffer;
  alternatives: SafeDealScoredOffer[];
  headline: string;
  summary: string;
  warnings: SafeDealRisk[];
  checklist: string[];
  supportTemplate: string;
  spreadPercent: number;
};

const staleOfferMs = 15 * 60 * 1000;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ageMs(value: string, now: Date) {
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? now.getTime() - timestamp : staleOfferMs + 1;
}

function uniqueTexts(items: SafeDealRisk[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.text)) return false;
    seen.add(item.text);
    return true;
  });
}

function riskWeight(severity: SafeDealRiskSeverity) {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function getOfferRisks({
  offer,
  amount,
  now
}: {
  offer: SafeDealOffer;
  amount: number;
  now: Date;
}) {
  const risks: SafeDealRisk[] = [];
  const coverage = offer.receivedAmount > 0 ? offer.reserve / offer.receivedAmount : 0;
  const updatedAge = ageMs(offer.updatedAt, now);

  if (offer.exchange.isDemo) {
    risks.push({ severity: "high", text: "профиль выглядит демонстрационным, не ведите туда крупную сделку" });
  }

  if (coverage < 1) {
    risks.push({ severity: "high", text: "резерв ниже суммы получения" });
  } else if (coverage < 1.25) {
    risks.push({ severity: "medium", text: "резерв почти впритык к вашей сумме" });
  }

  if (amount < offer.minAmount || amount > offer.maxAmount) {
    risks.push({ severity: "high", text: "сумма выходит за лимиты обменника" });
  }

  if (offer.exchange.rating !== null && offer.exchange.rating < 3.8) {
    risks.push({ severity: "high", text: "рейтинг заметно ниже безопасного уровня" });
  } else if (offer.exchange.rating !== null && offer.exchange.rating < 4.3) {
    risks.push({ severity: "medium", text: "рейтинг стоит проверить перед оплатой" });
  }

  if (offer.exchange.reviews < 3) {
    risks.push({ severity: "medium", text: "почти нет публичных отзывов" });
  } else if (offer.exchange.reviews < 10) {
    risks.push({ severity: "low", text: "мало отзывов для уверенного выбора" });
  }

  if (offer.kyc === "REQUIRED") {
    risks.push({ severity: "medium", text: "KYC обязателен, заранее подготовьте документы" });
  } else if (offer.kyc === "MAY_REQUIRE") {
    risks.push({ severity: "low", text: "KYC могут запросить после создания заявки" });
  }

  if (offer.processing === "MANUAL") {
    risks.push({ severity: "medium", text: "ручная обработка может занять больше времени" });
  } else if (offer.processing === "SEMI_AUTOMATIC") {
    risks.push({ severity: "low", text: "полуавтоматическая обработка, следите за статусом заявки" });
  }

  if (updatedAge > staleOfferMs) {
    risks.push({ severity: "medium", text: "курс давно не обновлялся" });
  }

  if (offer.marks.includes("percent")) {
    risks.push({ severity: "low", text: "есть процентная комиссия, проверьте финальную сумму на сайте обменника" });
  }

  return risks;
}

function getReasonLabels(scored: SafeDealScoredOffer) {
  const reasons: string[] = [];
  const { offer } = scored;

  if (scored.securityScore >= 82) reasons.push("сильный скоринг безопасности");
  else if (scored.securityScore >= 68) reasons.push("приемлемый скоринг безопасности");

  if (scored.valueLossPercent <= 0.15) reasons.push("почти лучший курс в выдаче");
  else if (scored.valueLossPercent <= 0.75) reasons.push("небольшая доплата за спокойствие");

  if (scored.reserveCoverage >= 3) reasons.push("резерв с большим запасом");
  else if (scored.reserveCoverage >= 1.5) reasons.push("резерв покрывает сделку");

  if (offer.exchange.reviews >= 50) reasons.push("много отзывов");
  else if (offer.exchange.reviews >= 10) reasons.push("есть история отзывов");

  if (offer.processing === "AUTOMATIC") reasons.push("автоматическая обработка");
  if (offer.kyc === "NONE") reasons.push("без обязательного KYC");

  return reasons.slice(0, 4);
}

function scoreOffer({
  offer,
  bestReceived,
  profile,
  amount,
  now
}: {
  offer: SafeDealOffer;
  bestReceived: number;
  profile: SafeDealProfile;
  amount: number;
  now: Date;
}) {
  const security = assessOfferSecurity({
    kyc: offer.kyc,
    processing: offer.processing,
    rating: offer.exchange.rating,
    reviews: offer.exchange.reviews,
    reserve: offer.reserve,
    updatedAt: offer.updatedAt,
    verified: !offer.exchange.isDemo
  }, now);
  const priceRatio = bestReceived > 0 ? offer.receivedAmount / bestReceived : 0;
  const reserveCoverage = offer.receivedAmount > 0 ? offer.reserve / offer.receivedAmount : 0;
  const updatedAge = ageMs(offer.updatedAt, now);
  const freshnessScore = updatedAge <= 5 * 60 * 1000 ? 100 : updatedAge <= staleOfferMs ? 76 : 35;
  const reserveScore = reserveCoverage >= 3 ? 100 : reserveCoverage >= 1.5 ? 82 : reserveCoverage >= 1 ? 58 : 20;
  const reviewScore =
    offer.exchange.reviews >= 50 ? 100 :
    offer.exchange.reviews >= 10 ? 78 :
    offer.exchange.reviews > 0 ? 56 :
    28;
  const processingScore =
    offer.processing === "AUTOMATIC" ? 100 :
    offer.processing === "SEMI_AUTOMATIC" ? 76 :
    48;
  const priceScore = priceRatio * 100;
  const weights = profile === "value"
    ? { price: 0.42, security: 0.27, reserve: 0.12, freshness: 0.08, reviews: 0.07, processing: 0.04 }
    : profile === "safety"
      ? { price: 0.16, security: 0.43, reserve: 0.17, freshness: 0.1, reviews: 0.1, processing: 0.04 }
      : { price: 0.3, security: 0.34, reserve: 0.14, freshness: 0.08, reviews: 0.09, processing: 0.05 };
  const rawScore =
    priceScore * weights.price +
    security.score * weights.security +
    reserveScore * weights.reserve +
    freshnessScore * weights.freshness +
    reviewScore * weights.reviews +
    processingScore * weights.processing;
  const valueLossAmount = Math.max(0, bestReceived - offer.receivedAmount);
  const valueLossPercent = bestReceived > 0 ? (valueLossAmount / bestReceived) * 100 : 0;
  const scored: SafeDealScoredOffer = {
    offer,
    score: clampScore(rawScore),
    securityScore: security.score,
    reserveCoverage,
    valueLossAmount,
    valueLossPercent,
    risks: getOfferRisks({ offer, amount, now }),
    reasons: []
  };

  return {
    ...scored,
    reasons: getReasonLabels(scored)
  };
}

function buildHeadline(
  profile: SafeDealProfile,
  recommended: SafeDealScoredOffer,
  bestValue: SafeDealScoredOffer
) {
  if (profile === "value") {
    if (recommended.offer.id === bestValue.offer.id) {
      return `Лучшая цена с учетом риска: ${recommended.offer.exchange.name}`;
    }
    return `Выгодный компромисс: ${recommended.offer.exchange.name}`;
  }
  if (profile === "safety") {
    return `Самый спокойный вариант: ${recommended.offer.exchange.name}`;
  }
  return `Баланс курса и риска: ${recommended.offer.exchange.name}`;
}

function buildSummary({
  recommended,
  bestValue,
  safest
}: {
  recommended: SafeDealScoredOffer;
  bestValue: SafeDealScoredOffer;
  safest: SafeDealScoredOffer;
}) {
  const loss = recommended.valueLossPercent;
  const valueNote = recommended.offer.id === bestValue.offer.id
    ? "он же дает лучший курс в выдаче"
    : `лучшая цена у ${bestValue.offer.exchange.name}, но ${recommended.offer.exchange.name} выглядит спокойнее с потерей около ${loss.toFixed(2)}% к максимуму`;
  const safetyNote = recommended.offer.id === safest.offer.id
    ? "это также самый сильный вариант по безопасности"
    : `самый безопасный по скорингу сейчас ${safest.offer.exchange.name}`;

  return `${valueNote}; ${safetyNote}. Проверьте домен и финальную сумму перед оплатой.`;
}

function buildChecklist(to: string) {
  return [
    "Откройте обменник только по ссылке из мониторинга и проверьте домен.",
    "Сравните сумму к получению, комиссию и сеть с данными monik exchange.",
    `Убедитесь, что резерв в ${to} покрывает вашу заявку с запасом.`,
    "Сделайте скриншот условий до оплаты.",
    "После оплаты сохраните чек, txid или банковскую квитанцию."
  ];
}

function buildSupportTemplate({
  recommended,
  amount,
  from,
  to
}: {
  recommended: SafeDealScoredOffer;
  amount: number;
  from: string;
  to: string;
}) {
  return [
    `Здравствуйте. Создал заявку на обмен ${amount.toLocaleString("ru-RU")} ${from} на ${to} через ${recommended.offer.exchange.name}.`,
    "Оплату отправил, но зачисление пока не поступило.",
    "Прошу проверить статус заявки и подтвердить получение оплаты.",
    "Готов отправить номер заявки, чек/txid и скриншоты условий обмена."
  ].join("\n");
}

export function analyzeSafeDeal({
  offers,
  amount,
  from,
  to,
  profile,
  now = new Date()
}: {
  offers: SafeDealOffer[];
  amount: number;
  from: string;
  to: string;
  profile: SafeDealProfile;
  now?: Date;
}): SafeDealAnalysis | null {
  if (!offers.length || amount <= 0) return null;

  const bestReceived = Math.max(...offers.map((offer) => offer.receivedAmount));
  const worstReceived = Math.min(...offers.map((offer) => offer.receivedAmount));
  const scored = offers
    .map((offer) => scoreOffer({ offer, bestReceived, profile, amount, now }))
    .sort((left, right) => right.score - left.score);
  const byValue = [...scored].sort((left, right) => right.offer.receivedAmount - left.offer.receivedAmount);
  const bySafety = [...scored].sort((left, right) => right.securityScore - left.securityScore);
  const recommended = scored[0];
  const bestValue = byValue[0];
  const safest = bySafety[0];
  const warnings = uniqueTexts(scored.flatMap((item) => item.risks))
    .sort((left, right) => riskWeight(right.severity) - riskWeight(left.severity))
    .slice(0, 4);
  const spreadPercent = bestReceived > 0 ? ((bestReceived - worstReceived) / bestReceived) * 100 : 0;

  return {
    profile,
    offers: scored,
    recommended,
    bestValue,
    safest,
    alternatives: scored.filter((item) => item.offer.id !== recommended.offer.id).slice(0, 2),
    headline: buildHeadline(profile, recommended, bestValue),
    summary: buildSummary({ recommended, bestValue, safest }),
    warnings,
    checklist: buildChecklist(to),
    supportTemplate: buildSupportTemplate({ recommended, amount, from, to }),
    spreadPercent
  };
}
