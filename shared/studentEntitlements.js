/**
 * Canonical student entitlement snapshot.
 * Recurring Plus/Pro membership and Essay Support review credits are independent.
 */

import {
  buildSubscriptionEntitlement,
  deriveMembershipStatus,
  formatBillingDate
} from "./billingMembership.js";
import { evaluateMentorAccess, hasActiveMentorSubscription, normalizePlanId } from "./mentorAccess.js";

/**
 * Build one authoritative entitlement object for billing, booking, and mentor views.
 *
 * @param {{
 *   planId?: string | null,
 *   pendingPlanId?: string | null,
 *   subscriptionStatus?: string | null,
 *   cancelAtPeriodEnd?: boolean,
 *   billingPeriodStart?: string | null,
 *   billingPeriodEnd?: string | null,
 *   entitlementEndsAt?: string | null,
 *   sessionCredits?: { active?: boolean, allowance?: number, remaining?: number, used?: number, periodEnd?: string | null } | null,
 *   reviewCredits?: { purchased?: number, assigned?: number, remaining?: number } | null,
 *   packages?: unknown[],
 *   meetings?: unknown[],
 *   stripeCustomerId?: string | null,
 *   stripeSubscriptionId?: string | null,
 *   stripePriceId?: string | null,
 *   now?: Date
 * }} input
 */
export function buildStudentEntitlements(input = {}) {
  const now = input.now || new Date();
  const planId = normalizePlanId(input.planId);
  const pendingPlanId = input.pendingPlanId
    ? String(input.pendingPlanId).toLowerCase()
    : null;
  const endsAt = input.entitlementEndsAt || input.billingPeriodEnd || null;
  const sessionCredits = input.sessionCredits || null;
  const review = input.reviewCredits || {};
  const essayPurchased = Math.max(0, Number(review.purchased) || 0);
  const essayAssigned = Math.max(0, Number(review.assigned) || 0);
  const essayRemaining = Math.max(0, Number(review.remaining) || 0);

  const entitlement = buildSubscriptionEntitlement({
    planId,
    pendingPlanId,
    subscriptionStatus: input.subscriptionStatus,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    billingPeriodStart: input.billingPeriodStart || null,
    billingPeriodEnd: input.billingPeriodEnd || null,
    entitlementEndsAt: endsAt,
    sessionCreditsRemaining: sessionCredits?.active ? Number(sessionCredits.remaining) || 0 : 0,
    sessionCreditsTotal: sessionCredits?.active ? Number(sessionCredits.allowance) || 0 : 0,
    essaySupportPurchased: essayPurchased,
    essaySupportRemaining: essayRemaining,
    stripeCustomerId: input.stripeCustomerId || null,
    stripeSubscriptionId: input.stripeSubscriptionId || null,
    stripePriceId: input.stripePriceId || null,
    now
  });

  const effectiveMembership =
    entitlement.isActive && (entitlement.activePlanId === "plus" || entitlement.activePlanId === "pro")
      ? entitlement.activePlanId
      : null;

  const scheduledMembership =
    pendingPlanId === "plus" || pendingPlanId === "pro" ? pendingPlanId : null;
  const downgradeScheduled =
    effectiveMembership === "pro" && scheduledMembership === "plus";
  const upgradePending =
    effectiveMembership === "plus" && scheduledMembership === "pro";

  const statusInfo = deriveMembershipStatus({
    planId: effectiveMembership || planId,
    subscriptionStatus: input.subscriptionStatus,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    currentPeriodEnd: endsAt,
    now
  });

  const accessUser = {
    plan: effectiveMembership || planId,
    subscriptionStatus: input.subscriptionStatus,
    subscriptionCurrentPeriodEnd: endsAt,
    entitlementEndsAt: endsAt
  };

  const mentorAccess = evaluateMentorAccess({
    user: accessUser,
    meetings: input.meetings || [],
    packages: input.packages || [],
    sessionCredits,
    now
  });

  const canBookSession = Boolean(
    mentorAccess.allowed &&
      hasActiveMentorSubscription(accessUser) &&
      (Number(mentorAccess.subscriptionRemaining) > 0 || Number(mentorAccess.packageRemaining) > 0)
  );

  return {
    effectiveMembership,
    membershipStatus: statusInfo.key,
    membershipLabel: statusInfo.label,
    membershipAccessActive: Boolean(statusInfo.accessActive && effectiveMembership),
    membershipExplanation: null,
    currentPeriodStart: input.billingPeriodStart || null,
    currentPeriodEnd: endsAt,
    scheduledMembership,
    scheduledMembershipEffectiveAt: scheduledMembership ? endsAt : null,
    downgradeScheduled,
    upgradePending,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    sessionCreditsTotal: Number(sessionCredits?.allowance) || 0,
    sessionCreditsUsed:
      sessionCredits?.active
        ? Math.max(
            0,
            (Number(sessionCredits.allowance) || 0) - (Number(sessionCredits.remaining) || 0)
          )
        : 0,
    sessionCreditsRemaining: sessionCredits?.active ? Number(sessionCredits.remaining) || 0 : 0,
    sessionCreditsActive: Boolean(sessionCredits?.active),
    essaySupportCreditsPurchased: essayPurchased,
    essaySupportCreditsAssigned: essayAssigned,
    essaySupportCreditsRemaining: essayRemaining,
    hasEssaySupport: essayPurchased > 0 || essayRemaining > 0,
    mentorAccess,
    canBookSession,
    entitlement,
    statusInfo,
    scheduledChangeLabel: scheduledMembership
      ? `Switches to ${scheduledMembership === "pro" ? "Pro" : "Plus"} on ${formatBillingDate(endsAt) || "the next billing date"}`
      : null
  };
}

/**
 * Booking denial reason for student UI — never conflate paywall with availability.
 * @returns {"loading"|"no_subscription"|"no_session_credits"|"daily_booking_limit"|"no_mentor_availability"|"ok"}
 */
export function resolveBookingBlockReason({
  mentorAccess = null,
  mentorHasNoSlots = false,
  accessLoading = false
} = {}) {
  if (accessLoading || mentorAccess == null) return "loading";
  if (mentorAccess.reason === "daily_booking_limit" || mentorAccess.dailyBookingUsed) {
    return "daily_booking_limit";
  }
  if (mentorAccess.allowed) {
    return mentorHasNoSlots ? "no_mentor_availability" : "ok";
  }
  if (
    mentorAccess.reason === "no_session_credits" ||
    (Number(mentorAccess.allowance) > 0 &&
      Number(mentorAccess.subscriptionRemaining) <= 0 &&
      Number(mentorAccess.packageRemaining) <= 0)
  ) {
    return "no_session_credits";
  }
  if (
    mentorAccess.reason === "subscription_inactive" ||
    mentorAccess.reason === "no_sessions"
  ) {
    return "no_subscription";
  }
  return "no_subscription";
}
