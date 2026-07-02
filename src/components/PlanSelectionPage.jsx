import { CheckCircle, ChevronRight, WalletCards, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  MATCH_ONBOARDING_PATH,
  PLAN_SELECTION_PATH,
  isValidPlanId,
  postAuthDestination,
  userNeedsPlanSelection
} from "../lib/onboardingRoutes.js";
import { readCachedPlan } from "../lib/supabaseAuth.js";
import { getPlan, getPricingPlans } from "../lib/plans.js";
import { readOnboardingDraft, writeOnboardingDraft } from "../lib/onboardingFlow.js";
import { startBillingCheckout } from "../lib/auth.js";
import OnboardingShell from "./onboarding/OnboardingShell.jsx";

const PUBLIC_PLANS_PATH = "/plans";

function phaseIsOpen(phase) {
  return phase !== "closed" && phase !== "closing";
}

function phaseIsLocked(phase) {
  return phase === "opening" || phase === "navigating" || phase === "closing";
}

function queryWantsOpen(location) {
  const search = new URLSearchParams(location.search);
  return location.state?.walletOpen || search.get("wallet") === "open";
}

function querySelectedPlan(location) {
  const search = new URLSearchParams(location.search);
  const selected = location.state?.selectedPlanId || search.get("selected");
  return isValidPlanId(selected) ? selected : null;
}

function selectorPath(context) {
  return context === "onboarding" ? PLAN_SELECTION_PATH : PUBLIC_PLANS_PATH;
}

function detailPath(context, planId) {
  return `${selectorPath(context)}/${planId}`;
}

function WalletShell({ phase, open, locked, onToggle, onTransitionEnd, children }) {
  return (
    <section
      className={`plan-wallet plan-wallet--${phase} ${open ? "plan-wallet--open" : ""}`}
      aria-label="Prelude plan wallet"
      data-wallet-phase={phase}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="plan-wallet__back" aria-hidden="true" />

      <div id="plan-wallet-stack" className="plan-wallet__stack-wrap">
        {children}
      </div>

      <div className="plan-wallet__slot-shadow" aria-hidden="true" />
      <div className="plan-wallet__front" aria-hidden="true">
        <span className="plan-wallet__brand">
          <WalletCards aria-hidden="true" />
          <span>Prelude Plans</span>
        </span>
      </div>

      <button
        type="button"
        className="plan-wallet__microcopy"
        onClick={onToggle}
        disabled={locked}
        aria-label={open ? "Close Prelude Plans wallet" : "Open Prelude Plans wallet"}
      >
        {open ? "Close" : "Open"}
      </button>

      <button
        type="button"
        className="plan-wallet__toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="plan-wallet-stack"
        tabIndex={open ? -1 : 0}
        disabled={locked}
        aria-label={open ? "Close Prelude Plans wallet" : "Open Prelude Plans wallet"}
      />
    </section>
  );
}

function WalletPlanCard({ plan, selected, disabled, phase, onActivate, onKeyDown, onAnimationEnd, buttonRef }) {
  function handleClick() {
    if (disabled) return;
    onActivate(plan.id);
  }

  function handleKeyDown(event) {
    onKeyDown(event);
    if (disabled || event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(plan.id);
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id={`plan-wallet-tab-${plan.id}`}
      aria-selected={selected}
      tabIndex={disabled ? -1 : selected ? 0 : -1}
      className={`wallet-plan-card wallet-plan-card--${plan.id} ${selected ? "wallet-plan-card--selected" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onAnimationEnd={selected ? onAnimationEnd : undefined}
      disabled={disabled}
      data-wallet-phase={phase}
    >
      <span className="wallet-plan-card__name">{plan.name}</span>
      <span className="wallet-plan-card__price">
        {plan.price}
        <span>/mo</span>
      </span>
      {plan.isRecommended ? <span className="wallet-plan-card__badge">Best value</span> : null}
      <span className="wallet-plan-card__footer">
        <span>{selected ? "Selected" : "View plan"}</span>
        <ChevronRight aria-hidden="true" />
      </span>
    </button>
  );
}

function PlanCardStack({ plans, phase, open, selectedPlanId, onPreview, onActivate, onNavigateAnimationEnd }) {
  const cardRefs = useRef([]);
  const selectedIndex = Math.max(0, plans.findIndex((plan) => plan.id === selectedPlanId));
  const cardsAvailable = open && phase !== "opening" && phase !== "closing" && phase !== "navigating";

  function moveSelection(direction) {
    if (!cardsAvailable) return;
    const nextIndex = (selectedIndex + direction + plans.length) % plans.length;
    const nextPlan = plans[nextIndex];
    onPreview(nextPlan.id);
    requestAnimationFrame(() => cardRefs.current[nextIndex]?.focus());
  }

  function handleCardKeyDown(event) {
    if (!cardsAvailable) return;
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
      onPreview(plans[0].id);
      requestAnimationFrame(() => cardRefs.current[0]?.focus());
    }
    if (event.key === "End") {
      event.preventDefault();
      onPreview(plans[plans.length - 1].id);
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
          selected={plan.id === selectedPlanId}
          disabled={!cardsAvailable}
          phase={phase}
          onActivate={onActivate}
          onKeyDown={handleCardKeyDown}
          onAnimationEnd={onNavigateAnimationEnd}
          buttonRef={(node) => {
            cardRefs.current[index] = node;
          }}
        />
      ))}
    </div>
  );
}

function PublicPlansShell({ children }) {
  return (
    <main className="plans-flow">
      <div className="plans-flow__inner">
        <Link to="/" className="plans-flow__home-link">
          ← Back to Prelude
        </Link>
        <header className="plans-flow__head">
          <p className="plans-flow__eyebrow">Plan selection</p>
          <h1>Choose your Prelude plan</h1>
          <p>Open the wallet, compare the three tiers, and pick the mentorship level that fits your goals.</p>
        </header>
        {children}
      </div>
    </main>
  );
}

function PlanWalletSelector({ context, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const plans = getPricingPlans();
  const recommendedPlanId = useMemo(() => plans.find((plan) => plan.isRecommended)?.id || plans[0]?.id, [plans]);
  const draft = useMemo(() => (user?.id ? readOnboardingDraft(user.id) : {}), [user?.id]);
  const cachedPlan = useMemo(() => (user?.id ? readCachedPlan(user.id) : null), [user?.id]);
  const restoredPlanId = querySelectedPlan(location) ||
    (isValidPlanId(draft.selectedPlanId)
      ? draft.selectedPlanId
      : isValidPlanId(cachedPlan)
        ? cachedPlan
        : recommendedPlanId);
  const [walletPhase, setWalletPhase] = useState(queryWantsOpen(location) ? "open" : "closed");
  const [selectedPlanId, setSelectedPlanId] = useState(restoredPlanId);
  const navigatingPlanRef = useRef(null);
  const walletOpen = phaseIsOpen(walletPhase);
  const walletLocked = phaseIsLocked(walletPhase);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0];

  function persistDraft(patch) {
    if (!user?.id) return;
    writeOnboardingDraft(user.id, patch);
  }

  function handleOpenWallet() {
    if (walletPhase !== "closed") return;
    setWalletPhase("opening");
    persistDraft({ selectedPlanId });
  }

  function handleCloseWallet() {
    if (walletPhase !== "open") return;
    navigatingPlanRef.current = null;
    setWalletPhase("closing");
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
    if (walletPhase !== "open") return;
    setSelectedPlanId(planId);
    persistDraft({ selectedPlanId: planId });
  }

  function handleActivatePlan(planId) {
    if (walletPhase !== "open") return;
    navigatingPlanRef.current = planId;
    setSelectedPlanId(planId);
    setWalletPhase("navigating");
    persistDraft({ selectedPlanId: planId });
  }

  function navigateToPlan(planId) {
    navigate(detailPath(context, planId), {
      state: {
        fromWallet: true,
        walletOpen: true,
        selectedPlanId: planId
      }
    });
  }

  function handleWalletTransitionEnd(event) {
    if (event.target !== event.currentTarget || event.propertyName !== "min-height") return;
    if (walletPhase === "opening") setWalletPhase("open");
    if (walletPhase === "closing") setWalletPhase("closed");
  }

  function handleNavigateAnimationEnd(event) {
    if (event.animationName !== "plan-wallet-card-choose") return;
    if (walletPhase === "navigating" && navigatingPlanRef.current) {
      navigateToPlan(navigatingPlanRef.current);
    }
  }

  return (
    <div className="plan-wallet-experience">
      <div className="plan-wallet-experience__stage">
        <WalletShell
          phase={walletPhase}
          open={walletOpen}
          locked={walletLocked}
          onToggle={handleWalletToggle}
          onTransitionEnd={handleWalletTransitionEnd}
        >
          <PlanCardStack
            plans={plans}
            phase={walletPhase}
            open={walletOpen}
            selectedPlanId={selectedPlan.id}
            onPreview={handleSelectPlan}
            onActivate={handleActivatePlan}
            onNavigateAnimationEnd={handleNavigateAnimationEnd}
          />
        </WalletShell>
      </div>
    </div>
  );
}

function OnboardingPlanSelector() {
  const { user, ready } = useAuth();

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

  return (
    <OnboardingShell
      user={user}
      title="Choose your Prelude plan"
      subtitle="Open the wallet, compare the three tiers, and pick the mentorship level that fits your goals."
      eyebrow="Plan selection"
      hideContinue
      footerNote="Your selection is saved to your profile so Prelude can personalize your dashboard."
      className="plan-select-page"
    >
      <PlanWalletSelector context="onboarding" user={user} />
    </OnboardingShell>
  );
}

export function PlansPage() {
  const { user } = useAuth();
  return (
    <PublicPlansShell>
      <PlanWalletSelector context="public" user={user} />
    </PublicPlansShell>
  );
}

function PlanDetailContent({ plan, context, billingNotice, loadingPlan, onChoose, onClose }) {
  return (
    <main className={`plan-detail-page plan-detail-page--${context}`}>
      <div className="plan-detail-page__inner">
        <button type="button" className="plan-detail-page__close" onClick={onClose} aria-label="Close plan details">
          <X aria-hidden="true" />
        </button>

        <article className={`plan-detail-card plan-detail-card--${plan.id}`}>
          <header className="plan-detail-card__header">
            <div>
              <p className="plan-detail-card__eyebrow">Prelude plan</p>
              <h1>{plan.name}</h1>
            </div>
            {plan.isRecommended ? <span className="plan-detail-card__badge">Best value</span> : null}
          </header>

          <div className="plan-detail-card__price-row">
            <span className="plan-detail-card__price">{plan.price}</span>
            <span className="plan-detail-card__period">/mo</span>
            <span className="plan-detail-card__price-label">{plan.priceLabel}</span>
          </div>

          <p className="plan-detail-card__description">{plan.description}</p>

          {billingNotice ? (
            <p className="plan-detail-card__notice" role="status">
              {billingNotice}
            </p>
          ) : null}

          <button
            type="button"
            className="plan-detail-card__cta"
            onClick={onChoose}
            disabled={Boolean(loadingPlan)}
            aria-busy={Boolean(loadingPlan)}
          >
            {loadingPlan ? "Saving..." : `Choose ${plan.name}`}
          </button>

          <section className="plan-detail-card__features" aria-labelledby={`plan-detail-features-${plan.id}`}>
            <h2 id={`plan-detail-features-${plan.id}`}>Included</h2>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <CheckCircle aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="plan-detail-card__supporting">Billing is not charged during this step.</p>
        </article>
      </div>
    </main>
  );
}

export function PlanDetailPage({ context = "public" }) {
  const { planId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, ready, isAuthenticated, openRegister, saveUserPlan, refreshUser } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [billingNotice, setBillingNotice] = useState("");
  const allowGuestCheckout = import.meta.env.DEV || import.meta.env.VITE_ALLOW_GUEST_CHECKOUT === "true";

  if (!isValidPlanId(planId)) {
    return <Navigate to={`${selectorPath(context)}?wallet=open`} replace />;
  }

  if (context === "onboarding" && !ready) {
    return (
      <OnboardingShell user={user} loading title="Choose your plan" subtitle="Preparing your Prelude plan details..." hideContinue />
    );
  }

  if (context === "onboarding" && !user) {
    return <Navigate to="/login" replace state={{ from: `${PLAN_SELECTION_PATH}/${planId}` }} />;
  }

  if (context === "onboarding" && !userNeedsPlanSelection(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  const plan = getPlan(planId);

  function closePlanDetails() {
    navigate(`${selectorPath(context)}?wallet=open&selected=${plan.id}`, {
      replace: false,
      state: { walletOpen: true, selectedPlanId: plan.id }
    });
  }

  async function handleOnboardingChoose() {
    setBillingNotice("");
    setLoadingPlan(plan.id);
    try {
      await saveUserPlan(plan.id);
      await refreshUser();
      if (user?.id) writeOnboardingDraft(user.id, { selectedPlanId: plan.id, planConfirmed: true });
      navigate(MATCH_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setBillingNotice(err.message || "Could not save your plan. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handlePublicChoose() {
    setBillingNotice("");
    const requiresRealAccount = user?.authProvider === "demo" || user?.authProvider === "dev";

    if ((!isAuthenticated || requiresRealAccount) && !allowGuestCheckout) {
      setBillingNotice("Create an account or sign in to choose this plan.");
      openRegister();
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const result = await startBillingCheckout(plan.id, { guestCheckout: !isAuthenticated || requiresRealAccount });
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setBillingNotice("Plan checkout will turn on after billing is connected.");
      } else if (error.status === 401 || error.status === 403) {
        setBillingNotice("Create an account or sign in to choose this plan.");
        openRegister();
      } else {
        setBillingNotice(error.message || "Checkout is unavailable right now. Please try again.");
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <PlanDetailContent
      plan={plan}
      context={context}
      billingNotice={billingNotice}
      loadingPlan={loadingPlan}
      onChoose={context === "onboarding" ? handleOnboardingChoose : handlePublicChoose}
      onClose={closePlanDetails}
      fromWallet={Boolean(location.state?.fromWallet)}
    />
  );
}

export default OnboardingPlanSelector;
