import { PLAN_PRICE_CENTS } from "../../shared/billingCatalog.js";
import { formatUsd } from "../../shared/supportBundles.js";

export const PLAN_IDS = ["basic", "plus", "pro"];

const AI_FEATURES = [
  "Central application dashboard",
  "Deadline tracking",
  "Essay prompt organization",
  "Profile analyzer",
  "Strength and opportunity suggestions",
  "Scholarship and financial aid reminders"
];

export const FLEXIBLE_SESSION_CALLOUT_DETAIL = "Consulting, SAT/ACT, Academics";

export const PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    tagline: "Async admissions support with written application feedback.",
    priceLabel: "Paid",
    price: formatUsd(PLAN_PRICE_CENTS.basic),
    paid: true,
    isRecommended: false,
    description: "Foundational support from real college mentors.",
    features: [
      "2 full personal statement reviews per month",
      "2 full supplemental essay reviews for one college per month",
      "Assigned mentor messaging",
      "Personalized student roadmap",
      "Detailed written feedback and edits within 1–2 business days"
    ],
    aiFeatures: AI_FEATURES,
    softwareAccess: [
      "Personalized college roadmap",
      "Progress tracking dashboard",
      "Financial aid & scholarship resource library",
      "Prelude AI assistant (full access)"
    ],
    mentorSessions: "2 full personal statement reviews / month",
    messaging: "Assigned mentor messaging",
    mentorExtras: [
      "2 full supplemental essay reviews for one college per month",
      "Detailed written feedback and edits within 1–2 business days"
    ],
    roadmapFeatures: ["Personalized college roadmap", "Progress tracking dashboard"],
    sessionCredits: 0,
    applicationReviewCredits: 2
  },
  plus: {
    id: "plus",
    name: "Plus",
    tagline: "More mentor access, 1-on-1 support, and rewards.",
    priceLabel: "Paid",
    price: formatUsd(PLAN_PRICE_CENTS.plus),
    paid: true,
    isRecommended: false,
    description: "More mentor access, 1-on-1 support, and rewards.",
    features: [
      "Full mentor-network messaging",
      "Personalized college and academic guidance",
      "Earn Prelude Coins for progress",
      "Redeem coins for bonus sessions, multi-mentor essay feedback, tutoring, and more"
    ],
    aiFeatures: AI_FEATURES,
    softwareAccess: [
      "Everything in Basic software",
      "Customized college and application roadmap",
      "Identity-building tools & peer benchmarking insights",
      "Prelude AI assistant (full access)"
    ],
    mentorSessions: "2 flexible 1-on-1 sessions / month",
    messaging: "Full mentor-network messaging",
    mentorExtras: [
      "Personalized college and academic guidance",
      "Earn and redeem Prelude Coins"
    ],
    roadmapFeatures: ["Customized college and application roadmap", "Personalized college and academic guidance"],
    sessionCredits: 2,
    applicationReviewCredits: 2,
    flexibleSessionCallout: "2 Flexible 1-on-1 Sessions / Month",
    flexibleSessionDetail: FLEXIBLE_SESSION_CALLOUT_DETAIL,
    calloutKind: "sessions"
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Highest-touch support with more flexible sessions and full application review.",
    priceLabel: "Paid",
    price: formatUsd(PLAN_PRICE_CENTS.pro),
    paid: true,
    isRecommended: true,
    description: "End-to-end support with more flexible sessions, priority messaging, and full application review.",
    features: [
      "Priority mentor-network messaging",
      "Advanced personalized strategy tailored to your goals",
      "Full application review",
      "Essay and activities review",
      "Multi-mentor essay feedback",
      "Final application readiness check",
      "Earn Prelude Coins at a higher rate",
      "Advanced milestone rewards"
    ],
    aiFeatures: AI_FEATURES,
    softwareAccess: [
      "Everything in Plus software",
      "Advanced roadmap & gamified progress tracking",
      "School-specific strategy workspace",
      "Prelude AI assistant (full access)"
    ],
    mentorSessions: "4 flexible 1-on-1 sessions / month",
    messaging: "Priority mentor-network messaging",
    mentorExtras: [
      "Use sessions for consulting, SAT/ACT prep, or academic tutoring",
      "Full application review with essay and activity review",
      "Advanced milestone rewards"
    ],
    roadmapFeatures: ["Advanced roadmap & gamified progress tracking", "Deeper personalized strategy"],
    sessionCredits: 4,
    applicationReviewCredits: 2,
    flexibleSessionCallout: "4 Flexible 1-on-1 Sessions / Month",
    flexibleSessionDetail: FLEXIBLE_SESSION_CALLOUT_DETAIL,
    calloutKind: "sessions"
  }
};

export const PRICING_PLAN_ORDER = ["basic", "plus", "pro"];

export const SESSION_USE_CARDS = [
  {
    id: "college-consulting",
    title: "College Consulting",
    description:
      "Get personalized guidance for college planning, applications, essays, school selection, and admissions strategy."
  },
  {
    id: "sat-act-prep",
    title: "SAT & ACT Prep",
    description:
      "Work with a qualified tutor on testing strategy, practice-test review, difficult sections, and score improvement."
  },
  {
    id: "academic-tutoring",
    title: "Academic Tutoring",
    description:
      "Receive personalized support in challenging classes, homework, test preparation, and AP coursework."
  }
];

export function normalizePlanId(planId) {
  const raw = String(planId || "").trim().toLowerCase();
  if (!raw) return null;
  if (PLANS[raw]) return raw;
  const match = PLAN_IDS.find((id) => PLANS[id].name.toLowerCase() === raw);
  return match || null;
}

export function getPlan(planId) {
  return PLANS[normalizePlanId(planId)] ?? PLANS.basic;
}

export function getPricingPlans() {
  return PRICING_PLAN_ORDER.map((id) => PLANS[id]);
}

export function getPlanAccessSummary(planId) {
  const plan = getPlan(planId);
  return {
    software: plan.softwareAccess,
    mentor: [plan.mentorSessions, plan.messaging, ...plan.mentorExtras]
  };
}
