import { Check, Crown, Sparkles } from "lucide-react";
import { PLAN_BILLING_HIGHLIGHTS } from "./billingDisplayData.js";

export default function BillingCurrentPlanCard({ plan }) {
  const highlights = PLAN_BILLING_HIGHLIGHTS[plan.id] || plan.features.slice(0, 5);

  return (
    <article className={`billing-current-plan billing-current-plan--${plan.id}`}>
      <div className="billing-current-plan__left">
        <div className="billing-current-plan__header">
          <span className="billing-current-plan__icon" aria-hidden="true">
            <Crown />
          </span>
          <h3 className="billing-current-plan__name">{plan.name} Plan</h3>
          <div className="billing-current-plan__badges">
            <span className="billing-current-plan__badge billing-current-plan__badge--active">
              <span className="billing-current-plan__badge-dot" aria-hidden="true" />
              Active
            </span>
            {plan.isRecommended ? (
              <span className="billing-current-plan__badge billing-current-plan__badge--popular">
                <Sparkles className="billing-current-plan__badge-icon" aria-hidden="true" />
                Most Popular
              </span>
            ) : null}
          </div>
        </div>

        <p className="billing-current-plan__price">
          <span className="billing-current-plan__price-value">{plan.price}</span>
          <span className="billing-current-plan__price-period">/ month</span>
        </p>
      </div>

      <div className="billing-current-plan__divider" aria-hidden="true" />

      <div className="billing-current-plan__right">
        <h4 className="billing-current-plan__included-title">What&apos;s included</h4>
        <ul className="billing-current-plan__features">
          {highlights.map((item) => (
            <li key={item}>
              <span className="billing-current-plan__check" aria-hidden="true">
                <Check />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
