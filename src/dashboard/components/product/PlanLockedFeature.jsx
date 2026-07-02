import { Lock } from "lucide-react";
import { getFeatureLockCopy, PRICING_UPGRADE_HREF } from "../../../lib/planFeatures.js";
import { PrimaryButton } from "../ui/index.jsx";

export default function PlanLockedFeature({
  feature,
  title,
  description,
  actionLabel = "View Plans",
  compact = false,
  className = ""
}) {
  const copy = title ? { title, description } : getFeatureLockCopy(feature);

  return (
    <div className={`dash-plan-locked${compact ? " dash-plan-locked--compact" : ""}${className ? ` ${className}` : ""}`}>
      <div className="dash-plan-locked__icon-wrap" aria-hidden="true">
        <Lock className="dash-plan-locked__icon" />
      </div>
      <div className="dash-plan-locked__copy">
        <h3 className="dash-plan-locked__title">{copy.title}</h3>
        {copy.description ? <p className="dash-plan-locked__desc">{copy.description}</p> : null}
      </div>
      <PrimaryButton as="a" href={PRICING_UPGRADE_HREF} className="dash-plan-locked__cta">
        {actionLabel}
      </PrimaryButton>
    </div>
  );
}
