import { usePlanAccess } from "../../hooks/usePlanAccess.js";
import PlanLockedFeature from "./PlanLockedFeature.jsx";

export default function PlanFeatureGate({ feature, children, compact = false, className = "" }) {
  const { canAccess } = usePlanAccess();
  if (canAccess(feature)) return children;
  return <PlanLockedFeature feature={feature} compact={compact} className={className} actionLabel="Upgrade Plan" />;
}
