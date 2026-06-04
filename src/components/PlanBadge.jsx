import { getPlan } from "../lib/plans.js";

export default function PlanBadge({ planId, className = "" }) {
  const plan = getPlan(planId);
  return <span className={`plan-badge ${className}`}>{plan.name}</span>;
}
