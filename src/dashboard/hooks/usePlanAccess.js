import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPlan } from "../../lib/plans.js";
import {
  canAccessFeature,
  canBookWithSessionCredits,
  getFeatureLockCopy,
  getMonthlyOneOnOneLimit,
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
      canBookSession: (meetings) => canBookWithSessionCredits(plan, meetings)
    }),
    [plan, planDetails.name]
  );
}
