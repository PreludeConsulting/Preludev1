export const PLAN_IDS = ["basic", "plus", "pro"];

const AI_FEATURES = [
  "Central application dashboard",
  "Deadline tracking",
  "Essay prompt organization",
  "Profile analyzer",
  "Strength and opportunity suggestions",
  "Scholarship and financial aid reminders"
];

export const PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    tagline: "Foundational guidance for students beginning their college journey.",
    priceLabel: "Free",
    paid: false,
    isRecommended: false,
    description: "Foundational guidance for students beginning their college journey.",
    features: [
      "Monthly group mentorship session",
      "Access to a matched mentor through PreludeMatch",
      "Limited direct messaging",
      "Personalized college roadmap",
      "Progress tracking",
      "General essay brainstorming support",
      "Financial aid and scholarship resources",
      "General consultant support"
    ],
    aiFeatures: AI_FEATURES,
    softwareAccess: [
      "Personalized college roadmap",
      "Progress tracking dashboard",
      "Financial aid & scholarship resource library",
      "Prelude AI assistant (full access)"
    ],
    mentorSessions: "Monthly group mentorship session",
    messaging: "Limited direct messaging",
    mentorExtras: ["Access to a matched mentor through PreludeMatch", "General consultant support"],
    roadmapFeatures: ["Personalized college roadmap", "Progress tracking dashboard"]
  },
  plus: {
    id: "plus",
    name: "Plus",
    tagline: "More personalized guidance and consistent support.",
    priceLabel: "Paid",
    paid: true,
    isRecommended: false,
    description: "More personalized guidance and consistent support.",
    features: [
      "Everything in Basic",
      "Two 1-on-1 mentor sessions per month",
      "Additional monthly group strategy session",
      "Expanded direct messaging",
      "Customized college and application roadmap",
      "Identity-building coaching",
      "Essay feedback and revision support",
      "Peer benchmarking insights"
    ],
    aiFeatures: AI_FEATURES,
    softwareAccess: [
      "Everything in Basic software",
      "Customized college and application roadmap",
      "Identity-building tools & peer benchmarking insights",
      "Prelude AI assistant (full access)"
    ],
    mentorSessions: "2× 1-on-1 mentor sessions / month",
    messaging: "Expanded direct messaging",
    mentorExtras: [
      "Additional monthly group strategy session",
      "Identity-building coaching",
      "Essay feedback and revision support"
    ],
    roadmapFeatures: ["Customized college and application roadmap", "Identity-building tools"]
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "End-to-end support for students aiming for top-tier outcomes.",
    priceLabel: "Paid",
    paid: true,
    isRecommended: true,
    description: "End-to-end support for students aiming for top-tier outcomes.",
    features: [
      "Everything in Plus",
      "Weekly or biweekly 1-on-1 mentor sessions",
      "Priority mentor matching",
      "Priority direct messaging",
      "Comprehensive essay editing",
      "Full application review",
      "Interview preparation",
      "School-specific admissions strategy",
      "Advanced financial consulting",
      "Parent strategy sessions",
      "Premium gamified progress tracking"
    ],
    aiFeatures: AI_FEATURES,
    softwareAccess: [
      "Everything in Plus software",
      "Advanced roadmap & gamified progress tracking",
      "School-specific strategy workspace",
      "Prelude AI assistant (full access)"
    ],
    mentorSessions: "Weekly or biweekly 1-on-1 sessions",
    messaging: "Priority direct messaging",
    mentorExtras: [
      "Priority mentor matching",
      "Comprehensive essay editing & full application review",
      "Interview preparation",
      "Advanced financial consulting & parent strategy sessions"
    ],
    roadmapFeatures: ["Advanced roadmap & gamified progress tracking", "School-specific strategy workspace"]
  }
};

export const PRICING_PLAN_ORDER = ["basic", "plus", "pro"];

export function getPlan(planId) {
  return PLANS[planId] ?? PLANS.basic;
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
