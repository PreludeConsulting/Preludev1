import { getPlan, normalizePlanId } from "./plans.js";
import { appPath } from "./appPaths.js";

export const PLAN_TIERS = ["basic", "plus", "pro"];

const TIER_RANK = {
  basic: 0,
  plus: 1,
  pro: 2
};

export const PRICING_UPGRADE_HREF = `${appPath("/").replace(/\/$/, "")}/#pricing`;
export const PRICING_UPGRADE_TO = { pathname: "/", hash: "pricing" };

/** Shared flexible session credits — one pool for consulting, SAT/ACT, and tutoring. */
export const SESSION_CATEGORIES = [
  {
    id: "college-consulting",
    label: "College Consulting",
    shortLabel: "Consulting",
    description: "College planning, applications, essays, and admissions strategy with your mentor.",
    providerHint: "assigned-mentor",
    specialtyKeywords: ["application", "essay", "college", "admissions", "roadmap", "choosing"]
  },
  {
    id: "sat-act-prep",
    label: "SAT/ACT Prep",
    shortLabel: "SAT/ACT",
    description: "Testing strategy, practice review, and score improvement with a qualified tutor.",
    providerHint: "sat-tutor",
    specialtyKeywords: ["sat", "act", "test", "testing", "score", "practice"]
  },
  {
    id: "academic-tutoring",
    label: "Academic Tutoring",
    shortLabel: "Tutoring",
    description: "Subject support for classes, homework, tests, and AP coursework.",
    providerHint: "subject-tutor",
    specialtyKeywords: ["tutor", "homework", "math", "science", "english", "ap", "academic", "stem"]
  }
];

export function getSessionCategory(categoryId) {
  return SESSION_CATEGORIES.find((item) => item.id === categoryId) || null;
}

export function getUserPlan(user) {
  const raw = user?.plan || user?.subscriptionPlan || user?.planName || "";
  return normalizePlanId(raw) || "basic";
}

export const PLAN_FEATURES = {
  dashboardOverview: { minPlan: "basic" },
  calendarBasics: { minPlan: "basic" },
  assignedMentor: { minPlan: "basic" },
  assignedMentorMessaging: { minPlan: "basic" },
  basicProgress: { minPlan: "basic" },
  applicationComponentReviews: { minPlan: "basic" },
  mentorNetwork: { minPlan: "plus" },
  oneOnOneSessions: { minPlan: "plus" },
  fullMentorNetworkMessaging: { minPlan: "plus" },
  personalizedAdmissionsGuidance: { minPlan: "plus" },
  rewards: { minPlan: "plus" },
  satActPrep: { minPlan: "plus" },
  academicTutoring: { minPlan: "plus" },
  priorityMessaging: { minPlan: "pro" },
  proStrategy: { minPlan: "pro" },
  fullApplicationReview: { minPlan: "pro" },
  advancedRewards: { minPlan: "pro" }
};

export const FEATURE_LOCK_COPY = {
  rewards: {
    title: "Upgrade to unlock",
    description:
      "Prelude Rewards is included with Plus and Pro. Upgrade to earn coins, unlock bonus mentor sessions, and redeem rewards."
  },
  fullMentorNetworkMessaging: {
    title: "Upgrade to unlock",
    description:
      "Full mentor and tutor network messaging is included with Plus and Pro. Upgrade to message mentors across the Prelude network."
  },
  mentorNetwork: {
    title: "Upgrade to unlock",
    description:
      "Mentor network access is included with Plus and Pro. Upgrade to connect with mentors across the Prelude network."
  },
  priorityMessaging: {
    title: "Upgrade to unlock",
    description:
      "Priority mentor and tutor network messaging is included with Pro. Upgrade for faster responses across the Prelude network."
  },
  oneOnOneSessions: {
    title: "Upgrade to unlock",
    description:
      "Flexible 1-on-1 session credits are included with Plus and Pro. Upgrade to book college consulting, SAT/ACT prep, or academic tutoring."
  },
  personalizedAdmissionsGuidance: {
    title: "Upgrade to unlock",
    description:
      "Personalized admissions guidance is included with Plus and Pro. Upgrade for tailored support based on your goals and college list."
  },
  satActPrep: {
    title: "Upgrade to unlock",
    description:
      "SAT/ACT prep sessions are included with Plus and Pro flexible session credits. Upgrade to book test-prep support."
  },
  academicTutoring: {
    title: "Upgrade to unlock",
    description:
      "Academic tutoring sessions are included with Plus and Pro flexible session credits. Upgrade to book subject tutoring."
  },
  proStrategy: {
    title: "Upgrade to unlock",
    description:
      "Deeper personalized strategy is included with Pro. Upgrade for advanced planning based on your background and goals."
  },
  fullApplicationReview: {
    title: "Upgrade to unlock",
    description:
      "Pro full application review (final package readiness) is included with Pro. Basic and higher already include personal statement and supplemental essay review support."
  },
  advancedRewards: {
    title: "Upgrade to unlock",
    description:
      "Pro Boost adds +0.25x to your status multiplier so you earn 25% more coins, access Pro-only challenges, and unlock higher-value rewards faster."
  }
};

export function canAccessFeature(planId, featureKey) {
  const feature = PLAN_FEATURES[featureKey];
  if (!feature) return true;
  const plan = normalizePlanId(planId) || "basic";
  return TIER_RANK[plan] >= TIER_RANK[feature.minPlan];
}

export function getFeatureLockCopy(featureKey) {
  return (
    FEATURE_LOCK_COPY[featureKey] || {
      title: "Upgrade to unlock",
      description: "This feature is available on a higher Prelude plan. View plans to upgrade."
    }
  );
}

export function getRequiredPlanLabel(featureKey) {
  const feature = PLAN_FEATURES[featureKey];
  if (!feature) return "Plus";
  const labels = { basic: "Basic", plus: "Plus", pro: "Pro" };
  return labels[feature.minPlan] || "Plus";
}

/** Monthly flexible session credits (shared across consulting, SAT/ACT, tutoring). */
export function getMonthlyOneOnOneLimit(planId) {
  const plan = normalizePlanId(planId) || "basic";
  if (plan === "pro") return 4;
  if (plan === "plus") return 2;
  return 0;
}

export function getSessionAllowanceLabel(planId) {
  const plan = normalizePlanId(planId) || "basic";
  if (plan === "pro") return "4 flexible session credits included each month";
  if (plan === "plus") return "2 flexible session credits included each month";
  return null;
}

/** Monthly application-component review credits (separate from live session credits). */
export function getMonthlyApplicationReviewLimit(planId) {
  const plan = getPlan(normalizePlanId(planId) || "basic");
  const credits = Number(plan?.applicationReviewCredits);
  return Number.isFinite(credits) && credits > 0 ? credits : 0;
}

export function getApplicationReviewAllowanceLabel(planId) {
  const plan = normalizePlanId(planId) || "basic";
  // Basic keeps review credits without marketing the allowance on the session banner.
  if (plan === "basic") return null;
  const limit = getMonthlyApplicationReviewLimit(planId);
  if (!limit) return null;
  return `${limit} full personal statement reviews included each month`;
}

export function countApplicationReviewsThisPeriod(reviews = [], now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  return reviews.filter((review) => {
    const stamp = review?.submittedAt || review?.createdAt;
    if (!stamp) return false;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return false;
    if (date.getMonth() !== month || date.getFullYear() !== year) return false;
    const status = String(review.status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") return false;
    return true;
  }).length;
}

export function getRemainingApplicationReviews(planId, reviews = []) {
  const limit = getMonthlyApplicationReviewLimit(planId);
  if (!limit) return 0;
  const used = countApplicationReviewsThisPeriod(reviews);
  return Math.max(0, limit - used);
}

export function canSubmitApplicationReview(planId, reviews = []) {
  return getRemainingApplicationReviews(planId, reviews) > 0;
}

export function getApplicationReviewBalanceLabel(planId, reviews = []) {
  const limit = getMonthlyApplicationReviewLimit(planId);
  if (!limit) return null;
  const remaining = getRemainingApplicationReviews(planId, reviews);
  return `${remaining} of ${limit} application reviews remaining`;
}

export function countOneOnOneMeetingsThisMonth(meetings = [], now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  return meetings.filter((meeting) => {
    if (!meeting?.startTime) return false;
    const start = new Date(meeting.startTime);
    if (Number.isNaN(start.getTime())) return false;
    if (start.getMonth() !== month || start.getFullYear() !== year) return false;
    const status = String(meeting.status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") return false;
    return true;
  }).length;
}

export function getRemainingOneOnOneSessions(planId, meetings = []) {
  const limit = getMonthlyOneOnOneLimit(planId);
  if (!limit) return null;
  const used = countOneOnOneMeetingsThisMonth(meetings);
  return Math.max(0, limit - used);
}

export function canBookWithSessionCredits(planId, meetings = []) {
  const limit = getMonthlyOneOnOneLimit(planId);
  if (!limit) return false;
  return getRemainingOneOnOneSessions(planId, meetings) > 0;
}

export function getSessionCreditBalanceLabel(planId, meetings = []) {
  const limit = getMonthlyOneOnOneLimit(planId);
  if (!limit) return null;
  const remaining = getRemainingOneOnOneSessions(planId, meetings);
  return `${remaining} of ${limit} session credits remaining`;
}

export function providerMatchesSessionCategory(provider, categoryId) {
  const category = getSessionCategory(categoryId);
  if (!category) return true;
  if (category.providerHint === "assigned-mentor") return true;

  const haystack = [
    provider?.specialty,
    provider?.major,
    ...(provider?.specialties || []),
    ...(provider?.expertise || []),
    ...(provider?.tags || []),
    ...(provider?.targetMajors || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) return true;
  return category.specialtyKeywords.some((keyword) => haystack.includes(keyword));
}

export function filterProvidersForSessionCategory(providers = [], categoryId, { assignedMentor = null } = {}) {
  const category = getSessionCategory(categoryId);
  if (!category) return providers;

  if (category.providerHint === "assigned-mentor") {
    return assignedMentor ? [assignedMentor] : providers.slice(0, 1);
  }

  const matched = providers.filter((provider) => providerMatchesSessionCategory(provider, categoryId));
  return matched.length ? matched : providers;
}
