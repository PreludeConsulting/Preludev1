import { CheckCircle, ChevronRight, Sparkles, WalletCards, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { MATCH_ONBOARDING_PATH, PLAN_SELECTION_PATH, postAuthDestination, userNeedsPlanSelection } from "../lib/onboardingRoutes.js";
import { getPricingPlans } from "../lib/plans.js";
import AppLink from "./AppLink.jsx";

function tierLabel(index) {
  if (index === 0) return "Essential";
  if (index === 1) return "Elevated";
  return "Signature";
}

function WalletShell({ open, onOpen, onClose, children }) {
  return (
    <section className={`plan-wallet ${open ? "plan-wallet--open" : ""}`} aria-label="Prelude plan wallet">
      <button
        type="button"
        className="plan-wallet__surface"
        onClick={onOpen}
        aria-expanded={open}
        aria-controls="plan-wallet-stack"
        disabled={open}
      >
        <span className="plan-wallet__glow" aria-hidden="true" />
        <span className="plan-wallet__flap" aria-hidden="true" />
        <span className="plan-wallet__slot plan-wallet__slot--one" aria-hidden="true" />
        <span className="plan-wallet__slot plan-wallet__slot--two" aria-hidden="true" />
        <span className="plan-wallet__brand">
          <WalletCards aria-hidden="true" />
          <span>Prelude Wallet</span>
        </span>
        <span className="plan-wallet__hint">{open ? "Plans unlocked" : "Tap to reveal plans"}</span>
      </button>

      <div id="plan-wallet-stack" className="plan-wallet__stack-wrap">
        {children}
      </div>

      {open ? (
        <button type="button" className="plan-wallet__close" onClick={onClose} aria-label="Close plan wallet">
          <X aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

function WalletPlanCard({ plan, index, selected, loading, disabled, onSelect, onKeyDown, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id={`plan-wallet-tab-${plan.id}`}
      aria-selected={selected}
      aria-controls={`plan-wallet-panel-${plan.id}`}
      tabIndex={selected ? 0 : -1}
      className={`wallet-plan-card wallet-plan-card--${plan.id} ${selected ? "wallet-plan-card--selected" : ""}`}
      style={{ "--plan-card-index": index }}
      onClick={() => onSelect(plan.id)}
      onKeyDown={onKeyDown}
      disabled={disabled}
    >
      <span className="wallet-plan-card__shine" aria-hidden="true" />
      <span className="wallet-plan-card__topline">
        <span>{tierLabel(index)}</span>
        {plan.isRecommended ? <span className="wallet-plan-card__badge">Best value</span> : null}
      </span>
      <span className="wallet-plan-card__name">{plan.name}</span>
      <span className="wallet-plan-card__price">
        {plan.price}
        <span>/mo</span>
      </span>
      <span className="wallet-plan-card__desc">{plan.tagline}</span>
      <span className="wallet-plan-card__footer">
        <span>{selected ? "Selected" : loading ? "Saving" : "View plan"}</span>
        <ChevronRight aria-hidden="true" />
      </span>
    </button>
  );
}

function PlanCardStack({ plans, open, selectedPlanId, loadingPlan, onSelect }) {
  const cardRefs = useRef([]);
  const selectedIndex = Math.max(0, plans.findIndex((plan) => plan.id === selectedPlanId));

  function moveSelection(direction) {
    const nextIndex = (selectedIndex + direction + plans.length) % plans.length;
    const nextPlan = plans[nextIndex];
    onSelect(nextPlan.id);
    requestAnimationFrame(() => cardRefs.current[nextIndex]?.focus());
  }

  function handleCardKeyDown(event) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      onSelect(plans[0].id);
      requestAnimationFrame(() => cardRefs.current[0]?.focus());
    }
    if (event.key === "End") {
      event.preventDefault();
      onSelect(plans[plans.length - 1].id);
      requestAnimationFrame(() => cardRefs.current[plans.length - 1]?.focus());
    }
  }

  return (
    <div
      className={`plan-card-stack ${open ? "plan-card-stack--open" : ""}`}
      role="tablist"
      aria-label="Prelude plans"
      aria-orientation="horizontal"
    >
      {plans.map((plan, index) => (
        <WalletPlanCard
          key={plan.id}
          plan={plan}
          index={index}
          selected={plan.id === selectedPlanId}
          loading={loadingPlan === plan.id}
          disabled={!open}
          onSelect={onSelect}
          onKeyDown={handleCardKeyDown}
          buttonRef={(node) => {
            cardRefs.current[index] = node;
          }}
        />
      ))}
    </div>
  );
}

function PlanDetails({ plan, loading, error, onChoose }) {
  return (
    <section
      key={plan.id}
      id={`plan-wallet-panel-${plan.id}`}
      role="tabpanel"
      aria-labelledby={`plan-wallet-tab-${plan.id}`}
      className={`plan-wallet-details plan-wallet-details--${plan.id}`}
    >
      <div className="plan-wallet-details__header">
        <div>
          <p className="plan-wallet-details__eyebrow">Selected plan</p>
          <h2>{plan.name}</h2>
        </div>
        {plan.isRecommended ? <span className="plan-wallet-details__badge">Best value</span> : null}
      </div>

      <div className="plan-wallet-details__price-row">
        <span className="plan-wallet-details__price">{plan.price}</span>
        <span className="plan-wallet-details__period">/mo</span>
        <span className="plan-wallet-details__price-label">{plan.priceLabel}</span>
      </div>

      <p className="plan-wallet-details__description">{plan.description}</p>

      <div className="plan-wallet-details__feature-wrap">
        <h3>Included</h3>
        <ul className="plan-wallet-details__features">
          {plan.features.map((feature) => (
            <li key={feature}>
              <CheckCircle aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <div className="plan-wallet-details__error" role="alert">
          {error}
        </div>
      ) : null}

      <button type="button" className="plan-wallet-details__cta" onClick={() => onChoose(plan.id)} disabled={Boolean(loading)}>
        {loading ? "Saving…" : `Choose ${plan.name}`}
      </button>
    </section>
  );
}

export default function PlanSelectionPage() {
  const navigate = useNavigate();
  const { user, ready, saveUserPlan, refreshUser } = useAuth();
  const plans = getPricingPlans();
  const initialPlanId = useMemo(() => plans.find((plan) => plan.isRecommended)?.id || plans[0]?.id, [plans]);
  const [walletOpen, setWalletOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0];

  if (!ready) {
    return (
      <main className="plan-select-page plan-select-page--loading">
        <div className="plan-select-loading" aria-live="polite">
          <span className="plan-select-loading__mark" aria-hidden="true" />
          <span>Preparing your Prelude plan wallet…</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: PLAN_SELECTION_PATH }} />;
  }

  if (!userNeedsPlanSelection(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  function handleOpenWallet() {
    if (walletOpen) return;
    setWalletOpen(true);
  }

  function handleCloseWallet() {
    if (loadingPlan) return;
    setWalletOpen(false);
  }

  function handleSelectPlan(planId) {
    setSelectedPlanId(planId);
    setError("");
    if (!walletOpen) setWalletOpen(true);
  }

  async function handleChoosePlan(planId) {
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
    <main className={`plan-select-page ${walletOpen ? "plan-select-page--wallet-open" : ""}`}>
      <div className="plan-select-page__inner">
        <AppLink href="/" className="plan-select-page__back">← Back to Prelude</AppLink>
        <header className="plan-select-page__head">
          <p className="plan-select-page__eyebrow">Step 1 of 2</p>
          <h1 className="plan-select-page__title">Choose your Prelude plan</h1>
          <p className="plan-select-page__subtitle">
            Pick the level of mentorship and support that fits your goals. You can upgrade later — payment checkout will be added when billing is fully connected.
          </p>
        </header>

        <div className="plan-wallet-experience">
          <div className="plan-wallet-experience__stage">
            <WalletShell open={walletOpen} onOpen={handleOpenWallet} onClose={handleCloseWallet}>
              <PlanCardStack
                plans={plans}
                open={walletOpen}
                selectedPlanId={selectedPlan.id}
                loadingPlan={loadingPlan}
                onSelect={handleSelectPlan}
              />
            </WalletShell>
          </div>

          <div className="plan-wallet-experience__details" aria-live="polite">
            {walletOpen ? (
              <PlanDetails
                plan={selectedPlan}
                loading={loadingPlan === selectedPlan.id}
                error={error}
                onChoose={handleChoosePlan}
              />
            ) : (
              <section className="plan-wallet-placeholder" aria-label="Plan wallet instructions">
                <Sparkles aria-hidden="true" />
                <h2>Open the wallet to compare plans</h2>
                <p>Reveal the three Prelude tiers, then choose any card to bring its complete details forward.</p>
              </section>
            )}
          </div>
        </div>

        <p className="plan-select-page__note">
          Billing is not charged during this step. Your selection is saved to your profile so Prelude can personalize your dashboard.
        </p>
      </div>
    </main>
  );
}
