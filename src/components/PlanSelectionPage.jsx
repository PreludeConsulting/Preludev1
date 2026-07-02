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

function tierLabel(index) {
  if (index === 0) return "Essential";
  if (index === 1) return "Elevated";
  return "Signature";
}

function materialLabel(index) {
  if (index === 0) return "Silver";
  if (index === 1) return "Gold";
  return "Diamond";
}

const WALLET_OPEN_MS = 720;
const WALLET_CLOSE_MS = 520;
const CARD_EXPAND_MS = 520;
const CARD_SWITCH_MS = 620;

function WalletShell({ phase, open, locked, onToggle, children }) {
  return (
    <section
      className={`plan-wallet plan-wallet--${phase} ${open ? "plan-wallet--open" : ""}`}
      aria-label="Prelude plan wallet"
      data-wallet-phase={phase}
    >
      <button
        type="button"
        className="plan-wallet__surface"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="plan-wallet-stack"
        disabled={locked}
        aria-label={open ? "Close Prelude plan wallet" : "Open Prelude plan wallet"}
      >
        <span className="plan-wallet__shadow" aria-hidden="true" />
        <span className="plan-wallet__back" aria-hidden="true" />
        <span className="plan-wallet__card-peek plan-wallet__card-peek--one" aria-hidden="true" />
        <span className="plan-wallet__card-peek plan-wallet__card-peek--two" aria-hidden="true" />
        <span className="plan-wallet__body">
          <span className="plan-wallet__stitch plan-wallet__stitch--top" aria-hidden="true" />
          <span className="plan-wallet__slot plan-wallet__slot--one" aria-hidden="true" />
          <span className="plan-wallet__slot plan-wallet__slot--two" aria-hidden="true" />
          <span className="plan-wallet__brand">
            <WalletCards aria-hidden="true" />
            <span>Prelude Wallet</span>
          </span>
          <span className="plan-wallet__hint">{open ? "Tap wallet to close" : "Tap wallet to open"}</span>
          <span className="plan-wallet__clasp" aria-hidden="true" />
        </span>
      </button>

      <div id="plan-wallet-stack" className="plan-wallet__stack-wrap">
        {children}
      </div>
    </section>
  );
}

function WalletPlanCard({
  plan,
  index,
  selected,
  expanded,
  loading,
  disabled,
  phase,
  onSelect,
  onChoose,
  onKeyDown,
  buttonRef
}) {
  const material = materialLabel(index);
  const canShowDetails = expanded && (phase === "cardExpanded" || phase === "switchingCard" || phase === "expandingCard");
  const isDisabled = Boolean(disabled);

  function handleClick() {
    if (isDisabled) return;
    onSelect(plan.id);
  }

  function handleKeyDown(event) {
    onKeyDown(event);
    if (isDisabled || event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(plan.id);
    }
  }

  return (
    <div
      ref={buttonRef}
      role="tab"
      id={`plan-wallet-tab-${plan.id}`}
      aria-selected={selected}
      aria-controls={`plan-wallet-panel-${plan.id}`}
      aria-expanded={expanded}
      aria-disabled={isDisabled}
      tabIndex={disabled ? -1 : selected ? 0 : 0}
      aria-label={`${plan.name} plan, ${material} card material${expanded ? ", expanded" : ""}${selected ? ", selected" : ""}`}
      className={`wallet-plan-card wallet-plan-card--${plan.id} wallet-plan-card--${material.toLowerCase()} ${selected ? "wallet-plan-card--selected" : ""} ${expanded ? "wallet-plan-card--expanded" : ""}`}
      style={{ "--plan-card-index": index }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-wallet-phase={phase}
    >
      <span className="wallet-plan-card__grain" aria-hidden="true" />
      <span className="wallet-plan-card__shine" aria-hidden="true" />
      <span className="wallet-plan-card__edge" aria-hidden="true" />
      <span className="wallet-plan-card__topline">
        <span>{tierLabel(index)}</span>
        <span className="wallet-plan-card__material">{material}</span>
        {plan.isRecommended ? <span className="wallet-plan-card__badge">Best value</span> : null}
      </span>
      <span className="wallet-plan-card__summary">
        <span className="wallet-plan-card__name">{plan.name}</span>
        <span className="wallet-plan-card__price">
          {plan.price}
          <span>/mo</span>
        </span>
      </span>
      <span className="wallet-plan-card__desc">{plan.tagline}</span>
      <span
        id={`plan-wallet-panel-${plan.id}`}
        className="wallet-plan-card__details"
        aria-hidden={!canShowDetails}
      >
        <span className="wallet-plan-card__full-desc">{plan.description}</span>
        <span className="wallet-plan-card__feature-title">Included</span>
        <span className="wallet-plan-card__features">
          {plan.features.map((feature) => (
            <span key={feature} className="wallet-plan-card__feature">
              <CheckCircle aria-hidden="true" />
              <span>{feature}</span>
            </span>
          ))}
        </span>
        <span className="wallet-plan-card__disclaimer">Billing is not charged during this step.</span>
        <button
          type="button"
          className="wallet-plan-card__cta"
          disabled={Boolean(loading)}
          onClick={(event) => {
            event.stopPropagation();
            onChoose();
          }}
        >
          {loading ? "Saving..." : `Choose ${plan.name}`}
        </button>
      </span>
      <span className="wallet-plan-card__footer">
        <span>{expanded ? "Ready" : selected ? "Selected" : "View plan"}</span>
        <ChevronRight aria-hidden="true" />
      </span>
    </div>
  );
}

function PlanCardStack({ plans, phase, open, selectedPlanId, expandedPlanId, loadingPlan, onSelect, onChoose }) {
  const cardRefs = useRef([]);
  const selectedIndex = Math.max(0, plans.findIndex((plan) => plan.id === selectedPlanId));
  const cardsAvailable = open && phase !== "opening" && phase !== "closing" && phase !== "expandingCard" && phase !== "switchingCard";

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
      aria-orientation="horizontal"
    >
      {plans.map((plan, index) => (
        <WalletPlanCard
          key={plan.id}
          plan={plan}
          index={index}
          selected={plan.id === selectedPlanId}
          expanded={plan.id === expandedPlanId}
          loading={loadingPlan === plan.id}
          disabled={!cardsAvailable}
          phase={phase}
          onSelect={onSelect}
          onChoose={onChoose}
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
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0];
  const phaseTimerRef = useRef(null);
  const walletOpen = walletPhase !== "closed" && walletPhase !== "closing";
  const walletLocked =
    walletPhase === "opening" ||
    walletPhase === "closing" ||
    walletPhase === "expandingCard" ||
    walletPhase === "switchingCard" ||
    Boolean(loadingPlan);

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) window.clearTimeout(phaseTimerRef.current);
    };
  }, []);

  function transitionWallet(nextPhase, duration, afterTransition) {
    if (phaseTimerRef.current) window.clearTimeout(phaseTimerRef.current);
    setWalletPhase(nextPhase);
    if (!duration) {
      afterTransition?.();
      return;
    }
    phaseTimerRef.current = window.setTimeout(() => {
      phaseTimerRef.current = null;
      afterTransition?.();
    }, duration);
  }

  if (!ready) {
    return (
      <OnboardingShell user={user} loading title="Choose your plan" subtitle="Preparing your Prelude plan wallet…" hideContinue />
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
    transitionWallet("opening", WALLET_OPEN_MS, () => setWalletPhase("deckOpen"));
    persistDraft({ selectedPlanId });
  }

  function handleCloseWallet() {
    if ((walletPhase !== "deckOpen" && walletPhase !== "cardExpanded") || loadingPlan) return;
    setExpandedPlanId(null);
    transitionWallet("closing", WALLET_CLOSE_MS, () => setWalletPhase("closed"));
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

  function handleSelectPlan(planId) {
    if ((walletPhase !== "deckOpen" && walletPhase !== "cardExpanded") || loadingPlan) return;
    if (planId === expandedPlanId && walletPhase === "cardExpanded") return;
    setSelectedPlanId(planId);
    setError("");
    if (expandedPlanId && expandedPlanId !== planId) {
      transitionWallet("switchingCard", CARD_SWITCH_MS, () => {
        setExpandedPlanId(planId);
        setWalletPhase("cardExpanded");
      });
    } else {
      setExpandedPlanId(planId);
      transitionWallet("expandingCard", CARD_EXPAND_MS, () => setWalletPhase("cardExpanded"));
    }
    persistDraft({ selectedPlanId: planId });
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
          <WalletShell phase={walletPhase} open={walletOpen} locked={walletLocked} onToggle={handleWalletToggle}>
            <PlanCardStack
              plans={plans}
              phase={walletPhase}
              open={walletOpen}
              selectedPlanId={selectedPlan.id}
              expandedPlanId={expandedPlanId}
              loadingPlan={loadingPlan}
              onSelect={handleSelectPlan}
              onChoose={handleContinue}
            />
          </WalletShell>
        </div>
      </div>
    </OnboardingShell>
  );
}
