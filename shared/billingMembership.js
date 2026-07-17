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
    const paidPlan = plan === "plus" || plan === "pro" || status === "promotional";
    return {
      key: "active",
      label: "Active",
      autoRenew: !cancelAtPeriodEnd && paidPlan,
      accessActive: paidPlan || plan === "basic",
      endsAt: null,
      renewsAt: !cancelAtPeriodEnd && periodEndValid ? periodEnd.toISOString() : null
    };
  }

  if (CANCELED.has(status) || (cancelAtPeriodEnd && periodEndValid && !stillInPaidPeriod)) {
    return {
      key: periodEndValid && !stillInPaidPeriod ? "expired" : "canceled",
      label: periodEndValid && !stillInPaidPeriod ? "Expired" : "Canceled",
      autoRenew: false,
      accessActive: false,
      endsAt: periodEndValid ? periodEnd.toISOString() : null,
      renewsAt: null
    };
  }

  if (!status && plan === "basic") {
    return {
      key: "none",
      label: "No paid membership",
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

export function membershipAccessExplanation(statusInfo, { sessionBalance = 0 } = {}) {
  if (statusInfo.key === "cancels_at_period_end" && statusInfo.endsAt) {
    return `Your membership remains active until ${formatBillingDateTime(statusInfo.endsAt)}. You will not be charged again unless you renew.`;
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
  return "Your membership has ended. Purchase a monthly subscription or individual sessions to continue contacting mentors.";
}

export function canCancelMembership(statusInfo) {
  return statusInfo?.key === "active" || statusInfo?.key === "trial";
}

export function canReactivateMembership(statusInfo) {
  return statusInfo?.key === "cancels_at_period_end";
}

export function canPurchaseMembership(statusInfo) {
  return !statusInfo?.accessActive || statusInfo?.key === "expired" || statusInfo?.key === "canceled" || statusInfo?.key === "none";
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
