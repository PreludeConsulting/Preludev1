export const PLAN_BADGE_TYPES = Object.freeze({
  plus: "mostPopular",
  pro: "bestValue"
});

const PLAN_BADGE_LABELS = Object.freeze({
  en: Object.freeze({ mostPopular: "Most Popular", bestValue: "Best Value" }),
  ko: Object.freeze({ mostPopular: "가장 인기", bestValue: "최고의 가치" }),
  zh: Object.freeze({ mostPopular: "最受欢迎", bestValue: "超值之选" }),
  es: Object.freeze({ mostPopular: "Más popular", bestValue: "Mejor valor" })
});

export function getPlanBadgeType(planId) {
  return PLAN_BADGE_TYPES[String(planId ?? "").trim().toLowerCase()] ?? null;
}

export function getPlanBadgeLabel(planId, language = "en") {
  const type = getPlanBadgeType(planId);
  if (!type) return null;
  return (PLAN_BADGE_LABELS[language] ?? PLAN_BADGE_LABELS.en)[type];
}
