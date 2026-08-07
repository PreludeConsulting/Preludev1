/**
 * Shared Plus↔Pro subscription entitlement resolution for Stripe sync.
 *
 * Rules:
 * - Plus→Pro: unlock Pro when Stripe's active price is Pro and payment is confirmed
 *   (or the latest invoice is already paid). Sticky pendingUpgrade metadata must
 *   never demote a confirmed Pro account.
 * - Pro→Plus: keep Pro as the EFFECTIVE membership through the current paid period;
 *   store Plus as a SCHEDULED membership until the period ends.
 * - Essay Support is never represented here (separate credit ledger).
 */

/**
 * @param {{
 *   priorPlanId?: string | null,
 *   mappedPlanId?: string | null,
 *   paymentConfirmed?: boolean,
 *   metadata?: Record<string, string | undefined> | null,
 *   subscriptionStatus?: string | null,
 *   currentPeriodEnd?: string | Date | null,
 *   now?: Date
 * }} input
 */
export function resolveSubscriptionPlanEntitlement({
  priorPlanId = null,
  mappedPlanId = null,
  paymentConfirmed = false,
  metadata = null,
  subscriptionStatus = null,
  currentPeriodEnd = null,
  now = new Date()
} = {}) {
  const prior = String(priorPlanId || "").toLowerCase();
  const mapped = String(mappedPlanId || "").toLowerCase();
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const metaPendingUpgrade = String(meta.pendingUpgrade || "").toLowerCase() === "true";
  const metaPendingDowngrade = String(meta.pendingDowngrade || "").toLowerCase() === "true";
  const metaPreviousPlan = String(meta.previousPlanId || "").toLowerCase();
  const metaPendingPlan = String(meta.pendingPlanId || "").toLowerCase();
  const status = String(subscriptionStatus || "").trim().toLowerCase();
  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const stillInPaidPeriod =
    periodEnd && !Number.isNaN(periodEnd.getTime()) && periodEnd.getTime() > now.getTime();

  const hasStalePendingUpgradeFlags =
    metaPendingUpgrade || metaPendingPlan === "pro" || metaPreviousPlan === "plus";
  const hasStalePendingDowngradeFlags =
    metaPendingDowngrade || metaPendingPlan === "plus" || metaPreviousPlan === "pro";

  // Paid / confirmed Pro price unlocks Pro and clears pending upgrade state.
  if (paymentConfirmed && mapped === "pro") {
    return {
      activePlanId: "pro",
      pendingPlanId: null,
      scheduledPlanId: null,
      shouldClearPendingMetadata: hasStalePendingUpgradeFlags || hasStalePendingDowngradeFlags
    };
  }

  // Already entitled to Pro while Stripe still maps to Pro.
  if (prior === "pro" && mapped === "pro") {
    return {
      activePlanId: "pro",
      pendingPlanId: null,
      scheduledPlanId: null,
      shouldClearPendingMetadata: hasStalePendingUpgradeFlags
    };
  }

  // Pro→Plus (Portal or app): keep Pro effective through the paid window.
  // Stripe may already show the Plus price/item; Prelude must not downgrade early.
  const scheduledDowngradeToPlus =
    (prior === "pro" || metaPreviousPlan === "pro" || metaPendingDowngrade) &&
    mapped === "plus" &&
    stillInPaidPeriod;

  if (scheduledDowngradeToPlus) {
    return {
      activePlanId: "pro",
      pendingPlanId: "plus",
      scheduledPlanId: "plus",
      shouldClearPendingMetadata: false
    };
  }

  // Scheduled Pro→Plus has reached period end — Plus is now effective.
  if (
    (prior === "pro" || metaPreviousPlan === "pro" || metaPendingDowngrade) &&
    mapped === "plus" &&
    !stillInPaidPeriod
  ) {
    return {
      activePlanId: "plus",
      pendingPlanId: null,
      scheduledPlanId: null,
      shouldClearPendingMetadata: true
    };
  }

  // Portal Plus→Pro with no pending-upgrade metadata: once Stripe maps to Pro and the
  // subscription is active, unlock Pro immediately (do not wait for a separate invoice flag).
  if (
    mapped === "pro" &&
    !metaPendingUpgrade &&
    ["active", "trialing", "checkout_completed"].includes(status)
  ) {
    return {
      activePlanId: "pro",
      pendingPlanId: null,
      scheduledPlanId: null,
      shouldClearPendingMetadata: hasStalePendingUpgradeFlags || hasStalePendingDowngradeFlags
    };
  }

  // In-flight Plus→Pro before payment confirmation (app change-plan metadata).
  const pendingUpgrade =
    (metaPendingUpgrade && (metaPreviousPlan === "plus" || metaPendingPlan === "pro")) ||
    (prior === "plus" && mapped === "pro" && !paymentConfirmed);

  if (pendingUpgrade && mapped === "pro") {
    return {
      activePlanId: "plus",
      pendingPlanId: "pro",
      scheduledPlanId: null,
      shouldClearPendingMetadata: false
    };
  }

  return {
    activePlanId: mapped || null,
    pendingPlanId: metaPendingPlan === "pro" && mapped !== "pro" ? "pro" : null,
    scheduledPlanId: null,
    shouldClearPendingMetadata: false
  };
}

export const CLEARED_PENDING_UPGRADE_METADATA = Object.freeze({
  pendingUpgrade: "",
  pendingDowngrade: "",
  pendingPlanId: "",
  previousPlanId: ""
});
