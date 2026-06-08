import { CheckCircle } from "lucide-react";
import { Button } from "./ui/button.jsx";

export default function PricingCard({
  plan,
  onSelect,
  loading,
  mostPopularLabel,
  startFreeLabel,
  chooseLabel,
  pleaseWaitLabel
}) {
  const ctaLabel = loading
    ? pleaseWaitLabel
    : plan.paid
      ? chooseLabel.replace(/\{\{plan\}\}/g, plan.name)
      : startFreeLabel;

  return (
    <article className={`pricing-card ${plan.isRecommended ? "pricing-card--featured" : ""}`}>
      <header className="pricing-card__header">
        <div className="pricing-card__badge-row">
          {plan.isRecommended ? (
            <span className="pricing-card__badge">{mostPopularLabel}</span>
          ) : null}
        </div>
        <div className="pricing-card__title-block">
          <h3 className="pricing-card__name shopify-hero__headline">{plan.name}</h3>
          <p className="pricing-card__price">{plan.priceLabel}</p>
        </div>
      </header>
      <p className="pricing-card__desc">{plan.description}</p>
      <ul className="pricing-card__features">
        {plan.features.slice(0, 6).map((feature) => (
          <li key={feature}>
            <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        as="button"
        type="button"
        variant="primary"
        className="pricing-card__cta"
        onClick={() => onSelect(plan)}
        disabled={loading}
      >
        {ctaLabel}
      </Button>
    </article>
  );
}
