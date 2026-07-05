export type KycModeValue = "NONE" | "MAY_REQUIRE" | "REQUIRED" | string;

export type SecurityAssessmentInput = {
  kyc?: KycModeValue | null;
  processing?: string | null;
  rating?: number | null;
  reviews?: number | null;
  reserve?: number | null;
  updatedAt?: string | Date | null;
  verified?: boolean | null;
  activeClaims?: number | null;
};

export type SecurityAssessment = {
  score: number;
  level: "high" | "medium" | "elevated";
  levelLabel: string;
  kycLabel: string;
  amlLabel: string;
  amlTone: "good" | "watch" | "risk";
  reasons: string[];
};

const maxFreshAgeMs = 15 * 60 * 1000;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function kycLabel(kyc: KycModeValue | null | undefined) {
  if (kyc === "NONE") return "KYC не требуется";
  if (kyc === "REQUIRED") return "KYC обязателен";
  return "KYC по запросу";
}

function updatedAgeMs(value: string | Date | null | undefined, now = new Date()) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? now.getTime() - timestamp : null;
}

export function assessOfferSecurity(
  input: SecurityAssessmentInput,
  now = new Date()
): SecurityAssessment {
  let score = 42;
  const reasons: string[] = [];
  const reviews = input.reviews ?? 0;
  const rating = input.rating ?? null;
  const reserve = input.reserve ?? 0;
  const activeClaims = input.activeClaims ?? 0;

  if (input.verified) {
    score += 12;
    reasons.push("профиль проверен");
  }

  if (rating !== null) {
    if (rating >= 4.7) {
      score += 16;
      reasons.push("высокий рейтинг");
    } else if (rating >= 4.2) {
      score += 10;
      reasons.push("хороший рейтинг");
    } else if (rating < 3.5) {
      score -= 12;
      reasons.push("рейтинг требует внимания");
    }
  } else {
    reasons.push("мало публичных оценок");
  }

  if (reviews >= 50) score += 10;
  else if (reviews >= 10) score += 6;
  else if (reviews > 0) score += 2;

  if (reserve >= 100_000) {
    score += 10;
    reasons.push("крупный резерв");
  } else if (reserve >= 10_000) {
    score += 5;
  } else if (reserve > 0) {
    score -= 4;
    reasons.push("небольшой резерв");
  }

  if (input.kyc === "REQUIRED") {
    score += 9;
    reasons.push("строгий KYC");
  } else if (input.kyc === "MAY_REQUIRE") {
    score += 5;
    reasons.push("KYC по риск-сценариям");
  } else if (input.kyc === "NONE") {
    reasons.push("без обязательного KYC");
  }

  if (input.processing === "AUTOMATIC") score += 4;
  if (input.processing === "MANUAL") score -= 5;

  const ageMs = updatedAgeMs(input.updatedAt, now);
  if (ageMs !== null) {
    if (ageMs <= 5 * 60 * 1000) score += 7;
    else if (ageMs <= maxFreshAgeMs) score += 3;
    else {
      score -= 8;
      reasons.push("курс давно не обновлялся");
    }
  }

  if (activeClaims > 0) {
    score -= Math.min(20, activeClaims * 6);
    reasons.unshift("есть активные претензии");
  }

  const finalScore = clampScore(score);
  const noKycPenalty = input.kyc === "NONE" ? 8 : 0;
  const amlScore = finalScore - noKycPenalty;
  const level =
    finalScore >= 78 ? "high" :
    finalScore >= 56 ? "medium" :
    "elevated";
  const amlTone =
    amlScore >= 78 ? "good" :
    amlScore >= 56 ? "watch" :
    "risk";

  return {
    score: finalScore,
    level,
    levelLabel:
      level === "high" ? "Высокая надежность" :
      level === "medium" ? "Средний риск" :
      "Повышенный риск",
    kycLabel: kycLabel(input.kyc),
    amlLabel:
      amlTone === "good" ? "AML: низкий риск" :
      amlTone === "watch" ? "AML: проверять сумму" :
      "AML: повышенный риск",
    amlTone,
    reasons: reasons.slice(0, 3)
  };
}
