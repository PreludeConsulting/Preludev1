/**
 * Shared Plus→Pro upgrade resolution for Stripe subscription sync.
 * Keeps Plus until a paid invoice confirms Pro, and never reverts Pro
 * because of sticky pendingUpgrade metadata left on the Stripe subscription.
 */

/**
 * @param {{
 *   priorPlanId?: string | null,
 *   mappedPlanId?: string | null,
 *   paymentConfirmed?: boolean,
 *   metadata?: Record<string, string | undefined> | null
 * }} input
 */
export function resolveSubscriptionPlanEntitlement({
  priorPlanId = null,
  mappedPlanId = null,
  paymentConfirmed = false,
  metadata = null
} = {}) {
  const prior = String(priorPlanId || "").toLowerCase();
  const mapped = String(mappedPlanId || "").toLowerCase();
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const metaPendingUpgrade = String(meta.pendingUpgrade || "").toLowerCase() === "true";
  const metaPreviousPlan = String(meta.previousPlanId || "").toLowerCase();
  const metaPendingPlan = String(meta.pendingPlanId || "").toLowerCase();
  const hasStalePendingFlags =
    metaPendingUpgrade || metaPendingPlan === "pro" || metaPreviousPlan === "plus";

  // Paid invoice for the Pro price unlocks Pro and clears pending state.
  if (paymentConfirmed && mapped === "pro") {
    return {
      activePlanId: "pro",
      pendingPlanId: null,
      shouldClearPendingMetadata: hasStalePendingFlags
    };
  }

  // Already entitled to Pro — sticky Stripe metadata must not demote the account.
  if (prior === "pro" && mapped === "pro") {
    return {
      activePlanId: "pro",
      pendingPlanId: null,
      shouldClearPendingMetadata: hasStalePendingFlags
    };
  }

  // In-flight Plus→Pro price change before payment confirmation.
  const pendingUpgrade =
    (metaPendingUpgrade && (metaPreviousPlan === "plus" || metaPendingPlan === "pro")) ||
    (prior === "plus" && mapped === "pro" && !paymentConfirmed);

  if (pendingUpgrade && mapped === "pro") {
    return {
      activePlanId: "plus",
      pendingPlanId: "pro",
      shouldClearPendingMetadata: false
    };
  }

  return {
    activePlanId: mapped || null,
    pendingPlanId: metaPendingPlan === "pro" && mapped !== "pro" ? "pro" : null,
    shouldClearPendingMetadata: false
  };
}

export const CLEARED_PENDING_UPGRADE_METADATA = Object.freeze({
  pendingUpgrade: "",
  pendingPlanId: "",
  previousPlanId: ""
});
