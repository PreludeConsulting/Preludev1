import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPlan } from "../../lib/plans.js";
import {
  canAccessFeature,
  canBookWithSessionCredits,
  canSubmitApplicationReview,
  getApplicationReviewAllowanceLabel,
  getApplicationReviewBalanceLabel,
  getFeatureLockCopy,
  getMonthlyApplicationReviewLimit,
  getMonthlyOneOnOneLimit,
  getRemainingApplicationReviews,
  getRemainingOneOnOneSessions,
  getSessionAllowanceLabel,
  getSessionCreditBalanceLabel,
  getUserPlan
} from "../../lib/planFeatures.js";

export function usePlanAccess() {
  const { user } = useAuth();
  const plan = useMemo(() => getUserPlan(user), [user]);
  const planDetails = useMemo(() => getPlan(plan), [plan]);

  return useMemo(
    () => ({
      plan,
      planName: planDetails.name,
      canAccess: (featureKey) => canAccessFeature(plan, featureKey),
      lockCopy: (featureKey) => getFeatureLockCopy(featureKey),
      monthlyOneOnOneLimit: getMonthlyOneOnOneLimit(plan),
      sessionAllowanceLabel: getSessionAllowanceLabel(plan),
      remainingOneOnOneSessions: (meetings) => getRemainingOneOnOneSessions(plan, meetings),
      sessionCreditBalanceLabel: (meetings) => getSessionCreditBalanceLabel(plan, meetings),
      canBookSession: (meetings, mentorAccess = null) => {
        if (mentorAccess && typeof mentorAccess.allowed === "boolean") return mentorAccess.allowed;
        return canBookWithSessionCredits(plan, meetings, user);
      },
      monthlyApplicationReviewLimit: getMonthlyApplicationReviewLimit(plan),
      applicationReviewAllowanceLabel: getApplicationReviewAllowanceLabel(plan),
      remainingApplicationReviews: (reviews) => getRemainingApplicationReviews(plan, reviews),
      applicationReviewBalanceLabel: (reviews, essayPackages) =>
        getApplicationReviewBalanceLabel(plan, reviews, { essayPackages }),
      canSubmitReview: (reviews, essayPackages) =>
        canSubmitApplicationReview(plan, reviews, { essayPackages })
    }),
    [plan, planDetails.name, user]
  );
}
