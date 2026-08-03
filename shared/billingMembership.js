/**
 * Shared billing membership helpers — status labels, dates, access copy.
 * Used by Settings Billing UI and Student/Parent billing pages.
 */
import { REFERRAL_BUSINESS_TIMEZONE } from "./referralConstants.js";

export const BILLING_DISPLAY_TIMEZONE = REFERRAL_BUSINESS_TIMEZONE;

const ACTIVE = new Set(["active", "trialing", "promotional", "checkout_completed"]);
const PAST_DUE = new Set(["past_due"]);
const INCOMPLETE = new Set(["incomplete", "incomplete_expired"]);
const CANCELED = new Set(["canceled", "cancelled", "unpaid"]);
const PAUSED = new Set(["paused"]);

export function formatMoneyCents(cents, currency = "usd", locale = "en-US") {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: String(currency || "usd").toUpperCase()
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

export function formatBillingDate(value, { timeZone = BILLING_DISPLAY_TIMEZONE, locale = "en-US" } = {}) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function formatBillingDateTime(value, { timeZone = BILLING_DISPLAY_TIMEZONE, locale = "en-US" } = {}) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

/**
 * Derive a user-facing membership status from Stripe-synced profile fields.
 */
export function deriveMembershipStatus({
  planId,
  subscriptionStatus,
  cancelAtPeriodEnd = false,
  currentPeriodEnd = null,
  now = new Date()
} = {}) {
  const status = String(subscriptionStatus || "").trim().toLowerCase();
  const plan = String(planId || "basic").toLowerCase();
  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const periodEndValid = periodEnd && !Number.isNaN(periodEnd.getTime());
  const stillInPaidPeriod = periodEndValid && periodEnd.getTime() > now.getTime();

  if (status === "trialing") {
    return {
      key: "trial",
      label: "Trial",
      autoRenew: !cancelAtPeriodEnd,
      accessActive: true,
      endsAt: periodEndValid ? periodEnd.toISOString() : null,
      renewsAt: !cancelAtPeriodEnd && periodEndValid ? periodEnd.toISOString() : null
    };
  }

  if (PAST_DUE.has(status)) {
    return {
      key: "past_due",
      label: "Past due",
      autoRenew: true,
      accessActive: stillInPaidPeriod,
      endsAt: periodEndValid ? periodEnd.toISOString() : null,
      renewsAt: null,
      paymentIssue: true
    };
  }

  if (INCOMPLETE.has(status)) {
    return {
      key: "incomplete",
      label: status === "incomplete_expired" ? "Incomplete" : "Payment required",
      autoRenew: false,
      accessActive: false,
      endsAt: null,
      renewsAt: null,
      paymentIssue: true
    };
  }

  if (PAUSED.has(status)) {
    return {
      key: "paused",
      label: "Paused",
      autoRenew: false,
      accessActive: false,
      endsAt: periodEndValid ? periodEnd.toISOString() : null,
      renewsAt: null
    };
  }

  if (cancelAtPeriodEnd && ACTIVE.has(status) && stillInPaidPeriod) {
    return {
      key: "cancels_at_period_end",
      label: `Cancels on ${formatBillingDate(periodEnd)}`,
      autoRenew: false,
      accessActive: true,
      endsAt: periodEnd.toISOString(),
      renewsAt: null
    };
  }

  if (ACTIVE.has(status) && (plan === "plus" || plan === "pro" || plan === "basic" || status === "promotional")) {
    const isPromotional = status === "promotional";
    const paidPlan = plan === "plus" || plan === "pro" || isPromotional;
    return {
      key: "active",
      label: isPromotional ? "Promotional" : "Active",
      // Complimentary promo access has no Stripe subscription and must not look like it renews/charges.
      autoRenew: !isPromotional && !cancelAtPeriodEnd && paidPlan,
      accessActive: paidPlan || plan === "basic",
      endsAt: null,
      renewsAt:
        !isPromotional && !cancelAtPeriodEnd && periodEndValid ? periodEnd.toISOString() : null
    };
  }

  // Canceled/unpaid but still within the already-paid window — keep access until entitlement ends.
  if (CANCELED.has(status) && stillInPaidPeriod && (plan === "plus" || plan === "pro")) {
    return {
      key: "cancels_at_period_end",
      label: `Access through ${formatBillingDate(periodEnd)}`,
      autoRenew: false,
      accessActive: true,
      endsAt: periodEnd.toISOString(),
      renewsAt: null
    };
  }

  if (CANCELED.has(status) || (cancelAtPeriodEnd && periodEndValid && !stillInPaidPeriod)) {
    return {
      key: "inactive",
      label: "Inactive",
      autoRenew: false,
      accessActive: false,
      endsAt: periodEndValid ? periodEnd.toISOString() : null,
      renewsAt: null
    };
  }

  if (!status && plan === "basic") {
    return {
      key: "inactive",
      label: "Inactive",
      autoRenew: false,
      accessActive: false,
      endsAt: null,
      renewsAt: null
    };
  }

  return {
    key: status || "unknown",
    label: status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown",
    autoRenew: false,
    accessActive: false,
    endsAt: periodEndValid ? periodEnd.toISOString() : null,
    renewsAt: null
  };
}

export function membershipAccessExplanation(statusInfo, { sessionBalance = 0, subscriptionCreditsRemaining = 0 } = {}) {
  if (statusInfo.key === "cancels_at_period_end" && statusInfo.endsAt) {
    const creditsNote =
      subscriptionCreditsRemaining > 0
        ? " You may continue using your remaining session credits until then."
        : "";
    return `Your subscription is scheduled to end on ${formatBillingDate(statusInfo.endsAt)}.${creditsNote}`;
  }
  if (statusInfo.key === "active" && statusInfo.renewsAt) {
    return `Your membership renews automatically on ${formatBillingDate(statusInfo.renewsAt)}.`;
  }
  if (statusInfo.key === "trial" && statusInfo.endsAt) {
    return `Your trial is active until ${formatBillingDate(statusInfo.endsAt)}.`;
  }
  if (statusInfo.paymentIssue) {
    return "There is a payment issue on this membership. Update your payment method to restore full access.";
  }
  if (statusInfo.accessActive) {
    return "Your membership is active.";
  }
  if (sessionBalance > 0) {
    return `Your monthly membership is inactive, but you still have ${sessionBalance} purchased session${sessionBalance === 1 ? "" : "s"} available.`;
  }
  return "Your membership is inactive.";
}

/**
 * Normalized entitlement DTO for `/api/me/subscription` and dashboard guards.
 */
export function buildSubscriptionEntitlement({
  planId,
  pendingPlanId = null,
  subscriptionStatus = null,
  cancelAtPeriodEnd = false,
  billingPeriodStart = null,
  billingPeriodEnd = null,
  entitlementEndsAt = null,
  sessionCreditsRemaining = 0,
  sessionCreditsTotal = 0,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  stripePriceId = null,
  now = new Date()
} = {}) {
  const activePlan = String(planId || "basic").toLowerCase();
  const pendingPlan = pendingPlanId ? String(pendingPlanId).toLowerCase() : null;
  const endsAt = entitlementEndsAt || billingPeriodEnd || null;
  const statusInfo = deriveMembershipStatus({
    planId: activePlan,
    subscriptionStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd: endsAt,
    now
  });
  const paidPlanActive =
    statusInfo.accessActive && (activePlan === "plus" || activePlan === "pro");
  return {
    activePlan: paidPlanActive ? activePlan.toUpperCase() : activePlan === "basic" ? "NONE" : activePlan.toUpperCase(),
    activePlanId: paidPlanActive ? activePlan : "basic",
    pendingPlan: pendingPlan ? pendingPlan.toUpperCase() : null,
    pendingPlanId: pendingPlan,
    subscriptionStatus: subscriptionStatus || null,
    isActive: paidPlanActive,
    cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
    downgradeScheduled: Boolean(pendingPlan && paidPlanActive && pendingPlan !== activePlan),
    cancellationScheduled: Boolean(cancelAtPeriodEnd && paidPlanActive),
    billingPeriodStart: billingPeriodStart || null,
    billingPeriodEnd: billingPeriodEnd || null,
    entitlementEndsAt: endsAt,
    sessionCreditsRemaining: Number(sessionCreditsRemaining) || 0,
    sessionCreditsTotal: Number(sessionCreditsTotal) || 0,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    stripePriceId: stripePriceId || null,
    membershipKey: statusInfo.key,
    membershipLabel: statusInfo.label,
    features: {
      plus: paidPlanActive && (activePlan === "plus" || activePlan === "pro"),
      pro: paidPlanActive && activePlan === "pro",
      sessionBooking: paidPlanActive,
      progressRewards: paidPlanActive
    }
  };
}

export function canCancelMembership(statusInfo) {
  return statusInfo?.key === "active" || statusInfo?.key === "trial";
}

export function canReactivateMembership(statusInfo) {
  return statusInfo?.key === "cancels_at_period_end";
}

export function canPurchaseMembership(statusInfo) {
  return (
    !statusInfo?.accessActive ||
    statusInfo?.key === "expired" ||
    statusInfo?.key === "canceled" ||
    statusInfo?.key === "inactive" ||
    statusInfo?.key === "none"
  );
}

export function logBillingEvent(event, payload = {}) {
  const safe = { ...payload };
  delete safe.email;
  delete safe.stripeCustomerId;
  delete safe.card;
  delete safe.paymentMethod;
  console.info(
    JSON.stringify({
      source: "prelude-billing",
      event,
      timestamp: new Date().toISOString(),
      ...safe
    })
  );
}
