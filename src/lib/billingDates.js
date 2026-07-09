/**
 * Resolve and format the next subscription bill date for dashboard billing UI.
 */

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Monthly anchor from account creation when Stripe period end is unavailable. */
export function estimateNextBillDate(user, now = new Date()) {
  const periodEnd = toDate(user?.subscriptionCurrentPeriodEnd);
  if (periodEnd && periodEnd > now) return periodEnd;

  const anchor = toDate(user?.createdAt) || now;
  const next = new Date(anchor);
  next.setHours(12, 0, 0, 0);

  while (next <= now) {
    next.setMonth(next.getMonth() + 1);
  }

  return next;
}

export function formatBillDate(date, locale) {
  const resolved = toDate(date);
  if (!resolved) return null;
  return resolved.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export function formatSubscriptionStatus(status) {
  if (!status) return "Active";
  const normalized = String(status).replace(/_/g, " ").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
