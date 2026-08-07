/**
 * Stripe Checkout Session.status values ("complete", "open", …) are not the same
 * as Subscription.status ("active", "trialing", …). Writing checkout status into
 * profiles.subscription_status marked paid Plus/Pro members as inactive.
 */

const CHECKOUT_SUCCESS_ALIASES = new Set(["complete", "checkout_completed"]);

const PAID_ACCESS_STATUSES = new Set([
  "active",
  "trialing",
  "promotional",
  "checkout_completed",
  "complete"
]);

/**
 * Map a raw Stripe status (subscription or checkout session) to the value we
 * persist as profiles.subscription_status for membership access.
 */
export function normalizePersistedSubscriptionStatus(status, { paymentSuccessful = false } = {}) {
  const raw = String(status || "").trim().toLowerCase();
  if (CHECKOUT_SUCCESS_ALIASES.has(raw)) return "active";
  if (raw) return raw;
  if (paymentSuccessful) return "active";
  return null;
}

export function isPaidMembershipStatus(status) {
  return PAID_ACCESS_STATUSES.has(String(status || "").trim().toLowerCase());
}
