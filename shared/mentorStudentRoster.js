/**
 * Mentor-facing student roster plan + credit display helpers.
 * Shared by Node and Cloudflare activity APIs — no hardcoded demo values.
 *
 * Plus/Pro subscriptions and Essay Support review credits are concurrent
 * entitlements. A student may have both at once; never treat them as XOR.
 */

import { hasActiveMentorSubscription, normalizePlanId } from "./mentorAccess.js";

export function mentorFacingPlanLabel(planId) {
  const id = normalizePlanId(planId);
  if (id === "basic") return "Essay Support";
  if (id === "plus") return "Plus";
  if (id === "pro") return "Pro";
  return "No active plan";
}

function normalizeReviewCredits(reviewCredits) {
  if (!reviewCredits) return null;
  const purchased = Math.max(0, Number(reviewCredits.purchased) || 0);
  const remaining = Math.max(0, Number(reviewCredits.remaining) || 0);
  const assigned = Math.max(0, Number(reviewCredits.assigned) || 0);
  if (purchased <= 0 && remaining <= 0) return null;
  return { purchased, assigned, remaining };
}

/**
 * Build the mentor Students card/detail fields from live profile + credit ledgers.
 */
export function buildMentorStudentPlanCredits({
  planId,
  subscriptionStatus = null,
  subscriptionCancelAtPeriodEnd = false,
  subscriptionCurrentPeriodEnd = null,
  reviewCredits = null,
  sessionCredits = null
} = {}) {
  const plan = normalizePlanId(planId);
  const activeSubscription = hasActiveMentorSubscription({
    plan,
    subscriptionStatus,
    subscriptionCurrentPeriodEnd
  });
  const reviewCreditsOut = normalizeReviewCredits(reviewCredits);
  // True essay-only: no active Plus/Pro. Review credits may still exist alongside a sub.
  const essaySupportOnly = !activeSubscription && Boolean(reviewCreditsOut || plan === "basic");
  const hasActivePeriod =
    Boolean(sessionCredits?.active) && Number(sessionCredits?.allowance || 0) > 0;

  let planLabel = "No active plan";
  let paymentType = null;
  let creditType = null;
  const usageParts = [];
  let sessionAllowance = null;

  if (activeSubscription) {
    planLabel = mentorFacingPlanLabel(plan);
    paymentType = "recurring";
    creditType = "session";
    if (hasActivePeriod) {
      const remaining = Math.max(0, Number(sessionCredits.remaining) || 0);
      const included = Math.max(0, Number(sessionCredits.allowance) || 0);
      sessionAllowance = { remaining, included };
      usageParts.push(`${remaining} of ${included} session credit${included === 1 ? "" : "s"} remaining`);
    } else {
      usageParts.push("No session credits in the current billing period");
    }
    if (subscriptionCancelAtPeriodEnd) {
      usageParts[usageParts.length - 1] = `${usageParts[usageParts.length - 1]} · Cancels at period end`;
    }
  }

  if (reviewCreditsOut) {
    if (!activeSubscription) {
      planLabel = "Essay Support";
      paymentType = "one_time";
      creditType = "review";
    }
    usageParts.push(
      `${reviewCreditsOut.remaining} of ${reviewCreditsOut.purchased || reviewCreditsOut.remaining} review credit${
        (reviewCreditsOut.purchased || reviewCreditsOut.remaining) === 1 ? "" : "s"
      } remaining`
    );
  } else if (!activeSubscription && plan === "basic") {
    planLabel = "Essay Support";
    paymentType = "one_time";
    creditType = "review";
    usageParts.push("0 review credits remaining");
  }

  // Concurrent services: show both plan names when Plus/Pro + Essay Support coexist.
  if (activeSubscription && reviewCreditsOut) {
    planLabel = `${mentorFacingPlanLabel(plan)} · Essay Support`;
    paymentType = "mixed";
    creditType = "session_and_review";
  }

  const usageSummary = usageParts.length ? usageParts.join(" · ") : "No active plan";

  return {
    plan,
    planLabel,
    paymentType,
    creditType,
    usageSummary,
    essaySupportOnly,
    hasActiveSubscription: activeSubscription,
    hasEssaySupportCredits: Boolean(reviewCreditsOut),
    reviewCredits: reviewCreditsOut || (!activeSubscription && plan === "basic"
      ? { purchased: 0, assigned: 0, remaining: 0 }
      : null),
    sessionAllowance,
    subscriptionStatus: subscriptionStatus || null,
    cancelAtPeriodEnd: Boolean(subscriptionCancelAtPeriodEnd)
  };
}
