/**
 * Stripe Basil+ (2025-03-31+) moved current_period_start/end from Subscription
 * onto SubscriptionItem. Prelude pins a post-Basil API version, so callers must
 * resolve period bounds from items when the top-level fields are absent.
 */

function asUnixSeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function itemPeriodField(subscription, field) {
  const items = subscription?.items?.data || [];
  const stamps = items.map((item) => asUnixSeconds(item?.[field])).filter(Boolean);
  if (!stamps.length) return null;
  return field === "current_period_end" ? Math.max(...stamps) : Math.min(...stamps);
}

/**
 * @returns {number | null} Unix seconds
 */
export function resolveSubscriptionPeriodUnix(subscription, field) {
  if (!subscription || (field !== "current_period_start" && field !== "current_period_end")) {
    return null;
  }
  return asUnixSeconds(subscription[field]) || itemPeriodField(subscription, field);
}

/**
 * @returns {{ startUnix: number | null, endUnix: number | null }}
 */
export function resolveSubscriptionPeriodBounds(subscription) {
  return {
    startUnix: resolveSubscriptionPeriodUnix(subscription, "current_period_start"),
    endUnix: resolveSubscriptionPeriodUnix(subscription, "current_period_end")
  };
}

/**
 * Prefer invoice line period, then subscription bounds (Basil-safe).
 * @returns {{ startUnix: number | null, endUnix: number | null }}
 */
export function resolveInvoiceSubscriptionPeriodBounds(invoice, subscription = null) {
  const lines = invoice?.lines?.data || [];
  const lineWithPeriod =
    lines.find((line) => asUnixSeconds(line?.period?.start) && asUnixSeconds(line?.period?.end)) ||
    lines[0];
  const lineStart = asUnixSeconds(lineWithPeriod?.period?.start);
  const lineEnd = asUnixSeconds(lineWithPeriod?.period?.end);
  const fromSub = resolveSubscriptionPeriodBounds(subscription);
  return {
    startUnix: lineStart || asUnixSeconds(invoice?.period_start) || fromSub.startUnix,
    endUnix: lineEnd || asUnixSeconds(invoice?.period_end) || fromSub.endUnix
  };
}

export function unixToIso(unixSeconds) {
  const n = asUnixSeconds(unixSeconds);
  if (!n) return null;
  return new Date(n * 1000).toISOString();
}
