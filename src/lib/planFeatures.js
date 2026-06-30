import { normalizePlanId } from "./plans.js";
import { appPath } from "./appPaths.js";

export const PLAN_TIERS = ["basic", "plus", "pro"];

const TIER_RANK = {
  basic: 0,
  plus: 1,
  pro: 2
};

export const PRICING_UPGRADE_HREF = appPath("/#pricing");

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
  mentorNetwork: { minPlan: "plus" },
  oneOnOneSessions: { minPlan: "plus" },
  fullMentorNetworkMessaging: { minPlan: "plus" },
  personalizedAdmissionsGuidance: { minPlan: "plus" },
  rewards: { minPlan: "plus" },
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
      "Full mentor-network messaging is included with Plus and Pro. Upgrade to message mentors across the Prelude network."
  },
  mentorNetwork: {
    title: "Upgrade to unlock",
    description:
      "Mentor network access is included with Plus and Pro. Upgrade to connect with mentors across the Prelude network."
  },
  priorityMessaging: {
    title: "Upgrade to unlock",
    description:
      "Priority mentor-network messaging is included with Pro. Upgrade for faster responses across the Prelude network."
  },
  oneOnOneSessions: {
    title: "Upgrade to unlock",
    description:
      "Monthly 1-on-1 mentor sessions are included with Plus and Pro. Upgrade to schedule private sessions with mentors."
  },
  personalizedAdmissionsGuidance: {
    title: "Upgrade to unlock",
    description:
      "Personalized admissions guidance is included with Plus and Pro. Upgrade for tailored support based on your goals and college list."
  },
  proStrategy: {
    title: "Upgrade to unlock",
    description:
      "Deeper personalized strategy is included with Pro. Upgrade for advanced planning based on your background and goals."
  },
  fullApplicationReview: {
    title: "Upgrade to unlock",
    description:
      "Full application review is included with Pro. Upgrade to get final review support before submission."
  },
  advancedRewards: {
    title: "Upgrade to unlock",
    description:
      "Advanced reward earning is included with Pro. Upgrade to earn coins faster and unlock higher-value rewards."
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

export function getMonthlyOneOnOneLimit(planId) {
  const plan = normalizePlanId(planId) || "basic";
  if (plan === "pro") return 4;
  if (plan === "plus") return 2;
  return 0;
}

export function getSessionAllowanceLabel(planId) {
  const plan = normalizePlanId(planId) || "basic";
  if (plan === "pro") return "4 monthly 1-on-1 sessions included";
  if (plan === "plus") return "2 monthly 1-on-1 sessions included";
  return "Monthly group mentor session included";
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
