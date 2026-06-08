import { CheckCircle } from "lucide-react";
import { Button } from "./ui/button.jsx";

function splitPrice(priceLabel) {
  if (!priceLabel) return { amount: "", period: "" };
  const slashIndex = priceLabel.indexOf("/");
  if (slashIndex === -1) return { amount: priceLabel, period: "" };
  return {
    amount: priceLabel.slice(0, slashIndex).trim(),
    period: priceLabel.slice(slashIndex).trim()
  };
}

export default function PricingCard({
  plan,
  onSelect,
  loading,
  mostPopularLabel,
  bestValueLabel,
  startFreeLabel,
  chooseLabel,
  pleaseWaitLabel
}) {
  const ctaLabel = loading
    ? pleaseWaitLabel
    : plan.paid
      ? chooseLabel.replace(/\{\{plan\}\}/g, plan.name)
      : startFreeLabel;

  const badgeLabel = plan.isRecommended
    ? mostPopularLabel
    : plan.id === "plus"
      ? bestValueLabel
      : null;

  const { amount, period } = splitPrice(plan.priceLabel);

  return (
    <article className={`pricing-card ${plan.isRecommended ? "pricing-card--featured" : ""}`}>
      {badgeLabel ? (
        <span className="pricing-card__badge">{badgeLabel}</span>
      ) : (
        <span className="pricing-card__badge-spacer" aria-hidden="true" />
      )}
      <h3 className="pricing-card__name shopify-hero__headline">{plan.name}</h3>
      <p className="pricing-card__price">
        <span className="pricing-card__price-amount">{amount}</span>
        {period ? <span className="pricing-card__price-period">{period}</span> : null}
      </p>
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
