import { CheckCircle, ChevronRight, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  MATCH_ONBOARDING_PATH,
  PLAN_SELECTION_PATH,
  isValidPlanId,
  postAuthDestination,
  userNeedsPlanSelection
} from "../lib/onboardingRoutes.js";
import { readCachedPlan } from "../lib/supabaseAuth.js";
import { getPricingPlans } from "../lib/plans.js";
import { readOnboardingDraft, writeOnboardingDraft } from "../lib/onboardingFlow.js";
import OnboardingShell from "./onboarding/OnboardingShell.jsx";

const WALLET_TIMING = {
  opening: 760,
  selecting: 360,
  switching: 300,
  closing: 620
};

function tierLabel(index) {
  if (index === 0) return "Essential";
  if (index === 1) return "Elevated";
  return "Signature";
}

function phaseIsOpen(phase) {
  return phase !== "closed" && phase !== "closing";
}

function phaseIsLocked(phase) {
  return phase === "opening" || phase === "selecting" || phase === "switching" || phase === "closing";
}

function WalletShell({ phase, open, locked, selectedPlan, loadingPlan, error, onToggle, onChoose, children }) {
  return (
    <section
      className={`plan-wallet plan-wallet--${phase} ${open ? "plan-wallet--open" : ""}`}
      aria-label="Prelude plan wallet"
      data-wallet-phase={phase}
    >
      <div className="plan-wallet__back-panel" aria-hidden="true" />
      <div className="plan-wallet__card-pocket" aria-hidden="true" />

      <div id="plan-wallet-stack" className="plan-wallet__stack-wrap">
        {children}
      </div>

      <button
        type="button"
        className="plan-wallet__front-panel"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="plan-wallet-stack plan-wallet-info"
        disabled={locked}
        aria-label={open ? "Close Prelude Plans wallet" : "Open Prelude Plans wallet"}
      >
        <span className="plan-wallet__front-highlight" aria-hidden="true" />
        <span className="plan-wallet__front-lines" aria-hidden="true" />
        <span className="plan-wallet__brand">
          <WalletCards aria-hidden="true" />
          <span>Prelude Plans</span>
        </span>
        <span className="plan-wallet__hint">{open ? "Tap to close" : "Tap to open"}</span>
        <span className="plan-wallet__clasp" aria-hidden="true" />
      </button>

      <section
        id="plan-wallet-info"
        className="plan-wallet__info"
        aria-live="polite"
        aria-hidden={!selectedPlan}
      >
        {selectedPlan ? (
          <div key={selectedPlan.id} className={`plan-wallet__info-content plan-wallet__info-content--${selectedPlan.id}`}>
            <header className="plan-wallet__info-header">
              <div>
                <p className="plan-wallet__eyebrow">Selected plan</p>
                <h2>{selectedPlan.name}</h2>
              </div>
              {selectedPlan.isRecommended ? <span className="plan-wallet__badge">Best value</span> : null}
            </header>

            <div className="plan-wallet__price-row">
              <span className="plan-wallet__price">{selectedPlan.price}</span>
              <span className="plan-wallet__period">/mo</span>
              <span className="plan-wallet__price-label">{selectedPlan.priceLabel}</span>
            </div>

            <p className="plan-wallet__description">{selectedPlan.description}</p>

            <div className="plan-wallet__feature-section">
              <h3>Included</h3>
              <ul className="plan-wallet__features">
                {selectedPlan.features.map((feature) => (
                  <li key={feature}>
                    <CheckCircle aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error ? (
              <div className="plan-wallet__error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="plan-wallet__action-row">
              <p>Billing is not charged during this step.</p>
              <button
                type="button"
                className="plan-wallet__cta"
                onClick={onChoose}
                disabled={Boolean(loadingPlan)}
                aria-busy={Boolean(loadingPlan)}
              >
                {loadingPlan ? "Saving..." : `Choose ${selectedPlan.name}`}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function WalletPlanCard({ plan, index, selected, disabled, phase, onSelect, onKeyDown, buttonRef }) {
  const cardsDisabled = Boolean(disabled);

  function handleClick() {
    if (cardsDisabled) return;
    onSelect(plan.id);
  }

  function handleKeyDown(event) {
    onKeyDown(event);
    if (cardsDisabled || event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(plan.id);
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id={`plan-wallet-tab-${plan.id}`}
      aria-selected={selected}
      aria-controls="plan-wallet-info"
      tabIndex={cardsDisabled ? -1 : selected ? 0 : -1}
      className={`wallet-plan-card wallet-plan-card--${plan.id} ${selected ? "wallet-plan-card--selected" : ""}`}
      style={{ "--plan-card-index": index }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={cardsDisabled}
      data-wallet-phase={phase}
    >
      <span className="wallet-plan-card__grain" aria-hidden="true" />
      <span className="wallet-plan-card__shine" aria-hidden="true" />
      <span className="wallet-plan-card__edge" aria-hidden="true" />
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
        <span>{selected ? "Selected" : "View plan"}</span>
        <ChevronRight aria-hidden="true" />
      </span>
    </button>
  );
}

function PlanCardStack({ plans, phase, open, selectedPlanId, onSelect }) {
  const cardRefs = useRef([]);
  const selectedIndex = Math.max(0, plans.findIndex((plan) => plan.id === selectedPlanId));
  const cardsAvailable = open && !phaseIsLocked(phase);

  function moveSelection(direction) {
    if (!cardsAvailable) return;
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
      className={`plan-card-stack plan-card-stack--${phase} ${open ? "plan-card-stack--open" : ""}`}
      role="tablist"
      aria-label="Prelude plans"
      aria-orientation="vertical"
    >
      {plans.map((plan, index) => (
        <WalletPlanCard
          key={plan.id}
          plan={plan}
          index={index}
          selected={plan.id === selectedPlanId}
          disabled={!cardsAvailable}
          phase={phase}
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

export default function PlanSelectionPage() {
  const navigate = useNavigate();
  const { user, ready, saveUserPlan, refreshUser } = useAuth();
  const plans = getPricingPlans();
  const recommendedPlanId = useMemo(() => plans.find((plan) => plan.isRecommended)?.id || plans[0]?.id, [plans]);
  const draft = useMemo(() => (user?.id ? readOnboardingDraft(user.id) : {}), [user?.id]);
  const cachedPlan = useMemo(() => (user?.id ? readCachedPlan(user.id) : null), [user?.id]);
  const restoredPlanId = isValidPlanId(draft.selectedPlanId)
    ? draft.selectedPlanId
    : isValidPlanId(cachedPlan)
      ? cachedPlan
      : recommendedPlanId;

  const [walletPhase, setWalletPhase] = useState("closed");
  const [selectedPlanId, setSelectedPlanId] = useState(restoredPlanId);
  const [visiblePlanId, setVisiblePlanId] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");
  const phaseTimerRef = useRef(null);
  const pendingPlanRef = useRef(null);
  const walletOpen = phaseIsOpen(walletPhase);
  const walletLocked = phaseIsLocked(walletPhase) || Boolean(loadingPlan);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0];
  const visiblePlan = visiblePlanId ? plans.find((plan) => plan.id === visiblePlanId) : null;

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) window.clearTimeout(phaseTimerRef.current);
    };
  }, []);

  function transitionWallet(nextPhase, duration, afterTransition) {
    if (phaseTimerRef.current) window.clearTimeout(phaseTimerRef.current);
    setWalletPhase(nextPhase);
    phaseTimerRef.current = window.setTimeout(() => {
      phaseTimerRef.current = null;
      afterTransition?.();
    }, duration);
  }

  if (!ready) {
    return (
      <OnboardingShell user={user} loading title="Choose your plan" subtitle="Preparing your Prelude plan wallet..." hideContinue />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: PLAN_SELECTION_PATH }} />;
  }

  if (!userNeedsPlanSelection(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  function persistDraft(patch) {
    if (!user?.id) return;
    writeOnboardingDraft(user.id, patch);
  }

  function handleOpenWallet() {
    if (walletPhase !== "closed") return;
    transitionWallet("opening", WALLET_TIMING.opening, () => setWalletPhase("open"));
    persistDraft({ selectedPlanId });
  }

  function handleCloseWallet() {
    if ((walletPhase !== "open" && walletPhase !== "expanded") || loadingPlan) return;
    pendingPlanRef.current = null;
    setVisiblePlanId(null);
    transitionWallet("closing", WALLET_TIMING.closing, () => setWalletPhase("closed"));
    persistDraft({ selectedPlanId });
  }

  function handleWalletToggle() {
    if (walletLocked) return;
    if (walletPhase === "closed") {
      handleOpenWallet();
      return;
    }
    handleCloseWallet();
  }

  function finishPlanSelection(planId) {
    const pendingPlanId = pendingPlanRef.current;
    if (pendingPlanId && pendingPlanId !== planId) {
      pendingPlanRef.current = null;
      beginPlanSelection(pendingPlanId, true);
      return;
    }
    pendingPlanRef.current = null;
    setVisiblePlanId(planId);
    setWalletPhase("expanded");
  }

  function beginPlanSelection(planId, hasVisiblePlan) {
    setSelectedPlanId(planId);
    setError("");
    persistDraft({ selectedPlanId: planId });

    if (!hasVisiblePlan) {
      transitionWallet("selecting", WALLET_TIMING.selecting, () => finishPlanSelection(planId));
      return;
    }

    setVisiblePlanId(null);
    transitionWallet("switching", WALLET_TIMING.switching, () => finishPlanSelection(planId));
  }

  function handleSelectPlan(planId) {
    if (loadingPlan) return;
    if (walletPhase === "selecting" || walletPhase === "switching") {
      pendingPlanRef.current = planId;
      setSelectedPlanId(planId);
      persistDraft({ selectedPlanId: planId });
      return;
    }
    if ((walletPhase !== "open" && walletPhase !== "expanded") || loadingPlan) return;
    if (planId === selectedPlanId && visiblePlanId === planId && walletPhase === "expanded") return;

    beginPlanSelection(planId, Boolean(visiblePlanId));
  }

  async function handleContinue() {
    if (!isValidPlanId(selectedPlanId)) {
      setError("Please select a valid Prelude plan before continuing.");
      return;
    }
    setError("");
    setLoadingPlan(selectedPlanId);
    try {
      await saveUserPlan(selectedPlanId);
      await refreshUser();
      persistDraft({ selectedPlanId, planConfirmed: true });
      navigate(MATCH_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setError(err.message || "Could not save your plan. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <OnboardingShell
      user={user}
      title="Choose your Prelude plan"
      subtitle="Open the wallet, compare the three tiers, and pick the mentorship level that fits your goals."
      eyebrow="Plan selection"
      onContinue={handleContinue}
      continueDisabled={!walletOpen || !isValidPlanId(selectedPlanId)}
      continueLoading={Boolean(loadingPlan)}
      hideContinue
      footerNote="Your selection is saved to your profile so Prelude can personalize your dashboard."
      className={`plan-select-page ${walletOpen ? "plan-select-page--wallet-open" : ""}`}
    >
      {error ? <div className="onboarding-flow__error" role="alert">{error}</div> : null}

      <div className="plan-wallet-experience">
        <div className="plan-wallet-experience__stage">
          <WalletShell
            phase={walletPhase}
            open={walletOpen}
            locked={walletLocked}
            selectedPlan={visiblePlan}
            loadingPlan={loadingPlan}
            error={error}
            onToggle={handleWalletToggle}
            onChoose={handleContinue}
          >
            <PlanCardStack
              plans={plans}
              phase={walletPhase}
              open={walletOpen}
              selectedPlanId={selectedPlan.id}
              onSelect={handleSelectPlan}
            />
          </WalletShell>
        </div>
      </div>
    </OnboardingShell>
  );
}
