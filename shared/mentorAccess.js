/** Shared mentor-request access helpers (client + server). */

import { buildStudentBillingPlansPath, STUDENT_BILLING_PATH } from "./stripePaymentLinks.js";

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

/** Calendar day key in a stable IANA zone (default ET) for daily booking limits. */
export function getBookingDayKey(date = new Date(), timeZone = "America/New_York") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date instanceof Date ? date : new Date(date));
  } catch {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
}

/**
 * True when this meeting counts toward the Plus/Pro once-per-day Book a Session limit.
 * Package-backed requests are excluded; canceled/declined do not block a later retry.
 */
export function isCountedDailySubscriptionBooking(meeting) {
  if (!meeting) return false;
  if (String(meeting.accessType || "").toLowerCase() === "session_package") return false;
  const status = String(meeting.status || "").toLowerCase();
  if (status === "canceled" || status === "cancelled" || status === "declined") return false;
  return true;
}

/**
 * Plus/Pro students may submit Book a Session at most once per calendar day (ET)
 * so accidental double submits do not burn monthly session credits.
 */
export function hasPlusProBookingSubmissionToday(
  meetings = [],
  { now = new Date(), timeZone = "America/New_York" } = {}
) {
  const today = getBookingDayKey(now, timeZone);
  if (!today) return false;
  return meetings.some((meeting) => {
    if (!isCountedDailySubscriptionBooking(meeting)) return false;
    const stamp = meeting.createdAt || meeting.created_at || meeting.submittedAt || null;
    if (!stamp) return false;
    const day = getBookingDayKey(new Date(stamp), timeZone);
    return day === today;
  });
}

export function buildDailyBookingLimitError() {
  return {
    code: "DAILY_BOOKING_LIMIT",
    error: "DAILY_BOOKING_LIMIT",
    message:
      "You can submit only one Book a Session request per day on Plus and Pro. Try again tomorrow."
  };
}

export function isDailyBookingLimitError(payloadOrError) {
  if (!payloadOrError) return false;
  const code =
    payloadOrError.code ||
    payloadOrError.error ||
    payloadOrError.payload?.code ||
    payloadOrError.payload?.error;
  return code === "DAILY_BOOKING_LIMIT";
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
 * Time-limited promotional access ends at promo_access_ends_at (or period end).
 */
export function hasActiveMentorSubscription(user = {}) {
  const plan = normalizePlanId(user.plan || user.subscriptionPlan || user.planName);
  if (plan !== "plus" && plan !== "pro") return false;

  const status = user.subscriptionStatus ?? user.subscription_status ?? null;
  const endsAt =
    user.entitlementEndsAt ??
    user.entitlement_ends_at ??
    user.promoAccessEndsAt ??
    user.promo_access_ends_at ??
    user.subscriptionCurrentPeriodEnd ??
    user.subscription_current_period_end ??
    null;
  const stillInPaidPeriod = (() => {
    if (!endsAt) return false;
    const end = new Date(endsAt);
    return !Number.isNaN(end.getTime()) && end.getTime() > Date.now();
  })();

  if (status == null || String(status).trim() === "") return true;

  const normalized = String(status).trim().toLowerCase();
  if (isActiveSubscriptionStatus(status)) {
    if (normalized === "promotional" && endsAt && !stillInPaidPeriod) return false;
    return true;
  }

  // Keep access through the already-paid window after cancel / past_due.
  if (
    stillInPaidPeriod &&
    (normalized === "canceled" ||
      normalized === "cancelled" ||
      normalized === "unpaid" ||
      normalized === "past_due")
  ) {
    return true;
  }

  return false;
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

/**
 * Remaining Plus/Pro session credits for the current paid billing period.
 * Prefer authoritative `sessionCredits` from the period ledger when provided.
 * Calendar-month counting is legacy fallback only when sessionCredits is omitted.
 */
export function getRemainingSubscriptionSessions(user = {}, meetings = [], now = new Date(), sessionCredits = undefined) {
  if (!hasActiveMentorSubscription(user)) return 0;
  if (sessionCredits !== undefined) {
    if (!sessionCredits?.active) return 0;
    return Math.max(0, Number(sessionCredits.remaining) || 0);
  }
  const limit = getMonthlyOneOnOneLimit(user.plan || user.subscriptionPlan || user.planName);
  if (!limit) return 0;
  const used = countOneOnOneMeetingsThisMonth(meetings, now);
  return Math.max(0, limit - used);
}

/** Live 1:1 session packages only — essay_support is review credits, not mentor sessions. */
export function isLiveSessionBundleId(bundleId) {
  const id = String(bundleId ?? "flexible_sessions")
    .trim()
    .toLowerCase();
  return id === "flexible_sessions" || id === "flexible" || id === "";
}

export function isEssaySupportBundleId(bundleId) {
  return String(bundleId || "")
    .trim()
    .toLowerCase() === "essay_support";
}

export function sumPackageRemaining(packages = [], { mentorId = null } = {}) {
  const now = Date.now();
  return packages.reduce((total, pkg) => {
    if (!pkg) return total;
    if (!isLiveSessionBundleId(pkg.bundleId)) return total;
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
 *
 * Pass `sessionCredits` from the paid-period ledger for authoritative Plus/Pro balances.
 * When omitted, falls back to legacy calendar-month counting (tests / offline only).
 */
export function evaluateMentorAccess({
  user = {},
  mentorId = null,
  meetings = [],
  packages = [],
  now = new Date(),
  sessionCredits = undefined
} = {}) {
  const subscriptionRemaining = getRemainingSubscriptionSessions(user, meetings, now, sessionCredits);
  const packageRemaining = sumPackageRemaining(packages, { mentorId });
  const remainingSessions = subscriptionRemaining + packageRemaining;
  const allowance =
    sessionCredits?.active && Number(sessionCredits.allowance) > 0
      ? Number(sessionCredits.allowance)
      : getMonthlyOneOnOneLimit(user.plan || user.subscriptionPlan || user.planName);
  const periodEnd = sessionCredits?.periodEnd || user.subscriptionCurrentPeriodEnd || user.subscription_current_period_end || null;

  const dailyBookingUsed =
    hasActiveMentorSubscription(user) &&
    hasPlusProBookingSubmissionToday(meetings, { now });

  if (dailyBookingUsed && subscriptionRemaining > 0) {
    return {
      allowed: false,
      accessType: null,
      remainingSessions: subscriptionRemaining + packageRemaining,
      subscriptionRemaining,
      packageRemaining,
      allowance,
      periodEnd,
      sessionCreditBalanceLabel:
        allowance > 0 ? `${subscriptionRemaining} of ${allowance} session credits remaining` : null,
      reason: "daily_booking_limit",
      dailyBookingUsed: true
    };
  }

  if (subscriptionRemaining > 0) {
    return {
      allowed: true,
      accessType: "subscription",
      remainingSessions,
      subscriptionRemaining,
      packageRemaining,
      allowance,
      periodEnd,
      sessionCreditBalanceLabel:
        allowance > 0 ? `${subscriptionRemaining} of ${allowance} session credits remaining` : null,
      reason: null,
      dailyBookingUsed: false
    };
  }

  if (packageRemaining > 0) {
    return {
      allowed: true,
      accessType: "session_package",
      remainingSessions,
      subscriptionRemaining,
      packageRemaining,
      allowance,
      periodEnd,
      sessionCreditBalanceLabel:
        allowance > 0 ? `${subscriptionRemaining} of ${allowance} session credits remaining` : null,
      reason: null,
      dailyBookingUsed: false
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

  const noCredits =
    hasActiveMentorSubscription(user) &&
    sessionCredits !== undefined &&
    (!sessionCredits?.active || subscriptionRemaining <= 0);

  return {
    allowed: false,
    accessType: null,
    remainingSessions: 0,
    subscriptionRemaining: 0,
    packageRemaining: 0,
    allowance,
    periodEnd,
    sessionCreditBalanceLabel:
      allowance > 0 ? `0 of ${allowance} session credits remaining` : null,
    reason: hadExpiredSub ? "subscription_inactive" : noCredits ? "no_session_credits" : "no_sessions",
    dailyBookingUsed: false
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
    wallet: "open",
    plan: "plus",
    details: "open"
  });
  if (mentorId) params.set("mentor", String(mentorId));
  if (mentorUserId) params.set("mentorUserId", String(mentorUserId));
  return `/plans?${params.toString()}`;
}

export function buildEssaySupportPath() {
  return buildStudentBillingPlansPath({ selection: "essay-support" });
}

export function buildSubscriptionPath() {
  return STUDENT_BILLING_PATH;
}
