/**
 * Shared helpers for opening the first Plus/Pro session-credit billing period.
 * Idempotent: one active ledger row per Stripe billing period (sub + period start).
 */

import { getMonthlyOneOnOneLimit, normalizePlanId } from "./mentorAccess.js";
import {
  resolveInvoiceSubscriptionPeriodBounds,
  resolveSubscriptionPeriodBounds,
  unixToIso
} from "./stripeSubscriptionPeriod.js";

export function getConfiguredSessionAllowance(planId) {
  return getMonthlyOneOnOneLimit(planId);
}

/**
 * Resolve Stripe current period bounds, falling back to expanded latest_invoice lines.
 * Never invents calendar-month windows.
 */
export function resolvePaidMembershipPeriodBounds(subscription) {
  const fromSub = resolveSubscriptionPeriodBounds(subscription);
  if (fromSub.startUnix && fromSub.endUnix) {
    return {
      startUnix: fromSub.startUnix,
      endUnix: fromSub.endUnix,
      startIso: unixToIso(fromSub.startUnix),
      endIso: unixToIso(fromSub.endUnix)
    };
  }
  const invoice =
    subscription?.latest_invoice && typeof subscription.latest_invoice === "object"
      ? subscription.latest_invoice
      : null;
  if (invoice) {
    const fromInvoice = resolveInvoiceSubscriptionPeriodBounds(invoice, subscription);
    if (fromInvoice.startUnix && fromInvoice.endUnix) {
      return {
        startUnix: fromInvoice.startUnix,
        endUnix: fromInvoice.endUnix,
        startIso: unixToIso(fromInvoice.startUnix),
        endIso: unixToIso(fromInvoice.endUnix)
      };
    }
  }
  return {
    startUnix: fromSub.startUnix,
    endUnix: fromSub.endUnix,
    startIso: unixToIso(fromSub.startUnix),
    endIso: unixToIso(fromSub.endUnix)
  };
}

export function sessionPeriodEnsureIdempotencyKey({ studentUserId, periodStartIso, periodEndIso, stripeSubscriptionId }) {
  if (stripeSubscriptionId && periodStartIso) {
    return `session-period:sub:${stripeSubscriptionId}:${periodStartIso}`;
  }
  return `session-period:ensure:${studentUserId}:${periodStartIso}:${periodEndIso}`;
}

/**
 * Whether an active Stripe Plus/Pro subscription should open period #1 credits now.
 * Stripe status active/trialing means the paid (or trial) period has begun —
 * do not wait for a separate invoice.paid flag.
 */
export function shouldInitializeSessionPeriodForSubscription({
  subscriptionStatus,
  planId,
  periodStartIso,
  periodEndIso
}) {
  const status = String(subscriptionStatus || "").trim().toLowerCase();
  const plan = normalizePlanId(planId);
  if (plan !== "plus" && plan !== "pro") return false;
  if (status !== "active" && status !== "trialing") return false;
  if (!periodStartIso || !periodEndIso) return false;
  if (new Date(periodEndIso).getTime() <= Date.now()) return false;
  return Boolean(getConfiguredSessionAllowance(plan));
}
