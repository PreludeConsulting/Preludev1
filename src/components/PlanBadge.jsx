import { getPlan, normalizePlanId } from "../lib/plans.js";

export default function PlanBadge({ planId, className = "" }) {
  const normalizedPlanId = normalizePlanId(planId);
  if (!normalizedPlanId) return null;
  const plan = getPlan(normalizedPlanId);
  return <span className={`plan-badge ${className}`}>{plan.name}</span>;
}
