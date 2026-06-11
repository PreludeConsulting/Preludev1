import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { MATCH_ONBOARDING_PATH, PLAN_SELECTION_PATH, postAuthDestination, userNeedsPlanSelection } from "../lib/onboardingRoutes.js";
import { getPricingPlans } from "../lib/plans.js";
import AppLink from "./AppLink.jsx";

function PlanCard({ plan, selected, loading, onSelect }) {
  return (
    <article className={`plan-select-card ${plan.isRecommended ? "plan-select-card--featured" : ""} ${selected ? "plan-select-card--selected" : ""}`}>
      {plan.isRecommended ? <span className="plan-select-card__badge">Best value</span> : null}
      <h2 className="plan-select-card__name">{plan.name}</h2>
      <p className="plan-select-card__price">{plan.price}<span className="plan-select-card__period">/mo</span></p>
      <p className="plan-select-card__desc">{plan.tagline}</p>
      <ul className="plan-select-card__features">
        {plan.features.slice(0, 5).map((feature) => (
          <li key={feature}>
            <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="plan-select-card__cta"
        disabled={loading}
        onClick={() => onSelect(plan.id)}
      >
        {loading && selected ? "Saving…" : `Choose ${plan.name}`}
      </button>
    </article>
  );
}

export default function PlanSelectionPage() {
  const navigate = useNavigate();
  const { user, ready, saveUserPlan, refreshUser } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");
  const plans = getPricingPlans();

  if (!ready) {
    return (
      <main className="plan-select-page">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: PLAN_SELECTION_PATH }} />;
  }

  if (!userNeedsPlanSelection(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  async function handleSelect(planId) {
    setError("");
    setLoadingPlan(planId);
    try {
      await saveUserPlan(planId);
      await refreshUser();
      navigate(MATCH_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setError(err.message || "Could not save your plan. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="plan-select-page">
      <div className="plan-select-page__inner">
        <AppLink href="/" className="plan-select-page__back">← Back to Prelude</AppLink>
        <header className="plan-select-page__head">
          <p className="plan-select-page__eyebrow">Step 1 of 2</p>
          <h1 className="plan-select-page__title">Choose your Prelude plan</h1>
          <p className="plan-select-page__subtitle">
            Pick the level of mentorship and support that fits your goals. You can upgrade later — payment checkout will be added when billing is fully connected.
          </p>
        </header>

        {error ? <div className="plan-select-page__error">{error}</div> : null}

        <div className="plan-select-page__grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={loadingPlan === plan.id}
              loading={Boolean(loadingPlan)}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <p className="plan-select-page__note">
          Billing is not charged during this step. Your selection is saved to your profile so Prelude can personalize your dashboard.
        </p>
      </div>
    </main>
  );
}
