export const PLAN_IDS = ["basic", "plus", "pro"];

export const PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    tagline: "Foundational guidance for students beginning their college journey.",
    softwareAccess: [
      "Personalized college roadmap",
      "Progress tracking dashboard",
      "Financial aid & scholarship resource library",
      "Prelude AI assistant (full access)"
    ],
    mentorSessions: "Monthly group mentorship session",
    messaging: "Limited direct messaging",
    mentorExtras: ["Access to a matched mentor through PreludeMatch", "General consultant support"]
  },
  plus: {
    id: "plus",
    name: "Plus",
    tagline: "More personalized guidance and consistent support.",
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
    ]
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "End-to-end support for students aiming for top-tier outcomes.",
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
    ]
  }
};

export function getPlan(planId) {
  return PLANS[planId] ?? PLANS.basic;
}

export function getPlanAccessSummary(planId) {
  const plan = getPlan(planId);
  return {
    software: plan.softwareAccess,
    mentor: [plan.mentorSessions, plan.messaging, ...plan.mentorExtras]
  };
}
