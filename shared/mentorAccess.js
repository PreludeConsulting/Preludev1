/** Shared mentor-request access helpers (client + server). */

export const NO_MENTOR_ACCESS_CODE = "NO_MENTOR_ACCESS";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "promotional"
]);

export const BLOCKED_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "incomplete_expired",
  "paused",
  "incomplete"
]);

const PLAN_MONTHLY_LIMITS = {
  basic: 0,
  plus: 2,
  pro: 4
};

export function normalizePlanId(planId) {
  const raw = String(planId || "")
    .trim()
    .toLowerCase();
  if (raw === "plus" || raw === "pro" || raw === "basic") return raw;
  return "basic";
}

export function getMonthlyOneOnOneLimit(planId) {
  return PLAN_MONTHLY_LIMITS[normalizePlanId(planId)] ?? 0;
}

export function isActiveSubscriptionStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (BLOCKED_SUBSCRIPTION_STATUSES.has(normalized)) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(normalized) || normalized === "checkout_completed";
}

/**
 * True when the student has a paid/promotional plan that includes mentor sessions.
 * Demo users with Plus/Pro and no Stripe status are treated as subscribed.
 */
export function hasActiveMentorSubscription(user = {}) {
  const plan = normalizePlanId(user.plan || user.subscriptionPlan || user.planName);
  if (plan !== "plus" && plan !== "pro") return false;

  const status = user.subscriptionStatus ?? user.subscription_status ?? null;
  if (status == null || String(status).trim() === "") return true;
  return isActiveSubscriptionStatus(status);
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
    if (status === "cancelled" || status === "canceled" || status === "declined") return false;
    // Package-backed requests do not consume monthly subscription credits.
    if (meeting.accessType === "session_package") return false;
    return true;
  }).length;
}

export function getRemainingSubscriptionSessions(user = {}, meetings = [], now = new Date()) {
  if (!hasActiveMentorSubscription(user)) return 0;
  const limit = getMonthlyOneOnOneLimit(user.plan || user.subscriptionPlan || user.planName);
  if (!limit) return 0;
  const used = countOneOnOneMeetingsThisMonth(meetings, now);
  return Math.max(0, limit - used);
}

export function sumPackageRemaining(packages = [], { mentorId = null } = {}) {
  const now = Date.now();
  return packages.reduce((total, pkg) => {
    if (!pkg) return total;
    const status = String(pkg.status || "active").toLowerCase();
    if (status !== "active") return total;
    if (pkg.expiresAt) {
      const expires = new Date(pkg.expiresAt).getTime();
      if (!Number.isNaN(expires) && expires <= now) return total;
    }
    const remaining = Number(pkg.sessionsRemaining);
    if (!Number.isFinite(remaining) || remaining <= 0) return total;
    // Mentor-scoped packages only count for that mentor; null mentorId = flexible (any mentor).
    if (pkg.mentorUserId && mentorId && pkg.mentorUserId !== mentorId) return total;
    if (pkg.mentorUserId && !mentorId) return total;
    return total + remaining;
  }, 0);
}

/**
 * Pure evaluation of mentor-request entitlement (no side effects).
 * Prefer subscription credits over package sessions so packages are not deducted when unnecessary.
 */
export function evaluateMentorAccess({
  user = {},
  mentorId = null,
  meetings = [],
  packages = [],
  now = new Date()
} = {}) {
  const subscriptionRemaining = getRemainingSubscriptionSessions(user, meetings, now);
  const packageRemaining = sumPackageRemaining(packages, { mentorId });
  const remainingSessions = subscriptionRemaining + packageRemaining;

  if (subscriptionRemaining > 0) {
    return {
      allowed: true,
      accessType: "subscription",
      remainingSessions,
      subscriptionRemaining,
      packageRemaining,
      reason: null
    };
  }

  if (packageRemaining > 0) {
    return {
      allowed: true,
      accessType: "session_package",
      remainingSessions,
      subscriptionRemaining,
      packageRemaining,
      reason: null
    };
  }

  const hadExpiredSub =
    hasActiveMentorSubscription(user) === false &&
    normalizePlanId(user.plan) !== "basic" &&
    BLOCKED_SUBSCRIPTION_STATUSES.has(
      String(user.subscriptionStatus || user.subscription_status || "")
        .trim()
        .toLowerCase()
    );

  return {
    allowed: false,
    accessType: null,
    remainingSessions: 0,
    subscriptionRemaining: 0,
    packageRemaining: 0,
    reason: hadExpiredSub
      ? "subscription_inactive"
      : packageRemaining === 0 && subscriptionRemaining === 0
        ? "no_sessions"
        : "no_sessions"
  };
}

export function buildNoMentorAccessError(
  message = "You need an available session or an active subscription to request this mentor."
) {
  return {
    code: NO_MENTOR_ACCESS_CODE,
    error: NO_MENTOR_ACCESS_CODE,
    message
  };
}

export function isNoMentorAccessError(payloadOrError) {
  if (!payloadOrError) return false;
  const code =
    payloadOrError.code ||
    payloadOrError.error ||
    payloadOrError.payload?.code ||
    payloadOrError.payload?.error;
  return code === NO_MENTOR_ACCESS_CODE;
}

/** Checkout / plans deep links with mentor context. */
export function buildPurchaseSessionsPath({ mentorId, mentorUserId } = {}) {
  const params = new URLSearchParams({
    mode: "bundles",
    wallet: "open",
    bundle: "flexible_sessions",
    details: "open"
  });
  if (mentorId) params.set("mentor", String(mentorId));
  if (mentorUserId) params.set("mentorUserId", String(mentorUserId));
  return `/plans?${params.toString()}`;
}

export function buildSubscriptionPath() {
  return "/dashboard/student/billing";
}
