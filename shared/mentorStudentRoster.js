/**
 * Mentor-facing student roster plan + credit display helpers.
 * Shared by Node and Cloudflare activity APIs — no hardcoded demo values.
 */

import { hasActiveMentorSubscription, normalizePlanId } from "./mentorAccess.js";

export function mentorFacingPlanLabel(planId) {
  const id = normalizePlanId(planId);
  if (id === "basic") return "Essay Support";
  if (id === "plus") return "Plus";
  if (id === "pro") return "Pro";
  return "No active plan";
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
  const essaySupportOnly = !activeSubscription;
  const hasActivePeriod =
    Boolean(sessionCredits?.active) && Number(sessionCredits?.allowance || 0) > 0;

  let planLabel = "No active plan";
  let paymentType = null;
  let creditType = null;
  let usageSummary = "No active plan";
  let sessionAllowance = null;
  let reviewCreditsOut = null;

  if (essaySupportOnly) {
    const purchased = Math.max(0, Number(reviewCredits?.purchased) || 0);
    const remaining = Math.max(0, Number(reviewCredits?.remaining) || 0);
    const assigned = Math.max(0, Number(reviewCredits?.assigned) || 0);
    if (purchased > 0 || remaining > 0) {
      planLabel = "Essay Support";
      paymentType = "one_time";
      creditType = "review";
      usageSummary = `${remaining} of ${purchased || remaining} review credit${purchased === 1 ? "" : "s"} remaining`;
      reviewCreditsOut = { purchased, assigned, remaining };
    } else if (plan === "basic") {
      planLabel = "Essay Support";
      paymentType = "one_time";
      creditType = "review";
      usageSummary = "0 review credits remaining";
      reviewCreditsOut = { purchased: 0, assigned: 0, remaining: 0 };
    }
  } else {
    planLabel = mentorFacingPlanLabel(plan);
    paymentType = "recurring";
    creditType = "session";
    if (hasActivePeriod) {
      const remaining = Math.max(0, Number(sessionCredits.remaining) || 0);
      const included = Math.max(0, Number(sessionCredits.allowance) || 0);
      sessionAllowance = { remaining, included };
      usageSummary = `${remaining} of ${included} session credit${included === 1 ? "" : "s"} remaining`;
    } else {
      usageSummary = "No session credits in the current billing period";
    }
    if (subscriptionCancelAtPeriodEnd) {
      usageSummary = `${usageSummary} · Cancels at period end`;
    }
  }

  return {
    plan,
    planLabel,
    paymentType,
    creditType,
    usageSummary,
    essaySupportOnly,
    reviewCredits: reviewCreditsOut,
    sessionAllowance,
    subscriptionStatus: subscriptionStatus || null,
    cancelAtPeriodEnd: Boolean(subscriptionCancelAtPeriodEnd)
  };
}
