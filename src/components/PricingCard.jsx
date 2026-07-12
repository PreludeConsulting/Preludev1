import { CheckCircle, FileText, Video } from "lucide-react";
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
  const CalloutIcon = plan.calloutKind === "reviews" ? FileText : Video;

  return (
    <article className={`pricing-card ${plan.isRecommended ? "pricing-card--featured" : ""}`}>
      <header className="pricing-card__header">
        <div className="pricing-card__badge-row">
          {plan.isRecommended ? (
            <span className="pricing-card__badge">{mostPopularLabel}</span>
          ) : null}
        </div>
        <h3 className="pricing-card__name shopify-hero__headline">{plan.name}</h3>
      </header>

      <p className="pricing-card__desc">{plan.description}</p>

      {plan.priceAmount ? (
        <p className="pricing-card__price" aria-label={`${plan.priceAmount}${plan.pricePeriod || ""}`}>
          <span className="pricing-card__price-amount">{plan.priceAmount}</span>
          {plan.pricePeriod ? <span className="pricing-card__price-period">{plan.pricePeriod}</span> : null}
        </p>
      ) : plan.priceLabel ? (
        <p className="pricing-card__price pricing-card__price--fallback">{plan.priceLabel}</p>
      ) : null}

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

      <div className="pricing-card__features-wrap">
        {plan.featureHeader ? (
          <p className="pricing-card__feature-header">{plan.featureHeader}</p>
        ) : null}

        {plan.flexibleSessionCallout ? (
          <div className="pricing-card__session-callout-block">
            <div className="pricing-card__session-callout">
              <CalloutIcon className="pricing-card__session-callout-icon" aria-hidden="true" />
              <div className="pricing-card__session-callout-copy">
                <span className="pricing-card__session-callout-text">{plan.flexibleSessionCallout}</span>
                {plan.flexibleSessionDetail ? (
                  <span className="pricing-card__session-callout-detail">{plan.flexibleSessionDetail}</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <ul className="pricing-card__features">
          {plan.features.map((feature) => (
            <li key={feature} className="pricing-card__feature-row">
              <CheckCircle className="pricing-card__feature-icon" size={16} strokeWidth={2} aria-hidden="true" />
              <span className="pricing-card__feature-text">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
