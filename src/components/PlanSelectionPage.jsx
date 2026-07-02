import { Check, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import {
  WALLET_STATES,
  cardsSelectable,
  createWalletState,
  popupVisible,
  walletReducer,
  walletShowsDeck
} from "../lib/planWalletMachine.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import OnboardingShell from "./onboarding/OnboardingShell.jsx";

const PUBLIC_PLANS_PATH = "/plans";
const logoSrc = `${import.meta.env.BASE_URL}media/prelude-logo.png`;

/** Durations must match the CSS transition times in plan-wallet.css. */
const MOTION_MS = {
  open: 700,
  selectCard: 380,
  popupEnter: 420,
  popupExit: 240,
  close: 520
};

function selectorPath(context) {
  return context === "onboarding" ? PLAN_SELECTION_PATH : PUBLIC_PLANS_PATH;
}

function restoreFromLocation(location) {
  const search = new URLSearchParams(location.search);
  const selected = location.state?.selectedPlanId || search.get("selected");
  return {
    walletOpen: Boolean(location.state?.walletOpen) || search.get("wallet") === "open",
    detailsOpen: search.get("details") === "open",
    selectedPlanId: isValidPlanId(selected) ? selected : null
  };
}

/* ------------------------------------------------------------------ */
/* Wallet machine hook                                                  */
/* ------------------------------------------------------------------ */

function useWalletMachine(initialState, reducedMotion) {
  const [state, dispatch] = useReducer(walletReducer, initialState, createWalletState);
  const { status, selectedPlanId } = state;

  useEffect(() => {
    const scale = reducedMotion ? 0 : 1;
    let delay = null;
    let settle = null;

    if (status === WALLET_STATES.OPENING) {
      delay = MOTION_MS.open * scale;
      settle = { type: "OPEN_SETTLED" };
    } else if (status === WALLET_STATES.SELECTING_CARD) {
      delay = MOTION_MS.selectCard * scale;
      settle = { type: "CARD_SETTLED" };
    } else if (status === WALLET_STATES.POPUP_OPENING) {
      delay = MOTION_MS.popupEnter * scale;
      settle = { type: "POPUP_SETTLED" };
    } else if (status === WALLET_STATES.POPUP_CLOSING) {
      delay = MOTION_MS.popupExit * scale;
      settle = { type: "POPUP_CLOSED" };
    } else if (status === WALLET_STATES.CLOSING) {
      delay = MOTION_MS.close * scale;
      settle = { type: "CLOSE_SETTLED" };
    }

    if (settle === null) return undefined;
    // Re-selecting a card while one is settling restarts the timer, so the
    // most recent valid selection always wins deterministically.
    const id = window.setTimeout(() => dispatch(settle), delay);
    return () => window.clearTimeout(id);
  }, [status, selectedPlanId, reducedMotion]);

  return [state, dispatch];
}

/* ------------------------------------------------------------------ */
/* Wallet pieces                                                        */
/* ------------------------------------------------------------------ */

function WalletBrandFooter({ email }) {
  return (
    <div className="pw-wallet__footer" aria-hidden="true">
      <span className="pw-wallet__brand">
        <img src={logoSrc} alt="" width={20} height={20} decoding="async" draggable={false} />
        <span>Prelude Consulting</span>
      </span>
      <span className="pw-wallet__email">{email || "Guest"}</span>
    </div>
  );
}

function WalletPlanCard({ plan, index, selected, selectable, onSelect, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`pw-card pw-card--${plan.id} ${selected ? "pw-card--selected" : ""}`}
      style={{ "--pw-i": index }}
      onClick={() => onSelect(plan.id)}
      disabled={!selectable}
      aria-haspopup="dialog"
      aria-pressed={selected}
      aria-label={`${plan.name} plan, ${plan.price} per month${selected ? ", selected" : ""}`}
      tabIndex={selectable ? 0 : -1}
    >
      <span className="pw-card__top">
        <span className="pw-card__name">{plan.name}</span>
        {plan.isRecommended ? <span className="pw-card__badge">Best value</span> : null}
        <span className="pw-card__price">
          {plan.price}
          <small>/mo</small>
        </span>
      </span>
      <span className="pw-card__tagline">{plan.tagline}</span>
      {selected ? (
        <span className="pw-card__selected-mark">
          <Check aria-hidden="true" />
          Selected
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Plan details popup                                                   */
/* ------------------------------------------------------------------ */

function getTabbable(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function PlanPopup({ plan, status, busy, notice, onSelectPlan, onViewOtherPlans, onRequestClose }) {
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const priceRef = useRef(null);
  const firstActionRef = useRef(null);
  const [priceFlash, setPriceFlash] = useState(false);
  const closing = status === WALLET_STATES.POPUP_CLOSING;

  // Lock background scrolling for the popup's whole lifetime.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Move focus into the dialog once it is interactive.
  useEffect(() => {
    if (status === WALLET_STATES.POPUP_OPEN) {
      firstActionRef.current?.focus();
    }
  }, [status]);

  useEffect(() => {
    if (!priceFlash) return undefined;
    const id = window.setTimeout(() => setPriceFlash(false), 1200);
    return () => window.clearTimeout(id);
  }, [priceFlash]);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onRequestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const tabbable = getTabbable(dialogRef.current);
    if (tabbable.length === 0) return;
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleViewPrice() {
    const priceEl = priceRef.current;
    if (!priceEl) return;
    priceEl.scrollIntoView({ behavior: "smooth", block: "start" });
    priceEl.focus({ preventScroll: true });
    setPriceFlash(true);
  }

  return (
    <div
      className={`pw-popup-layer ${closing ? "pw-popup-layer--closing" : ""}`}
      onKeyDown={handleKeyDown}
    >
      <div
        className="pw-popup-backdrop"
        onClick={busy ? undefined : onRequestClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`pw-popup-title-${plan.id}`}
        className={`pw-popup pw-popup--${plan.id}`}
      >
        <header className="pw-popup__head">
          <div className="pw-popup__head-row">
            <h2 id={`pw-popup-title-${plan.id}`}>{plan.name}</h2>
            {plan.isRecommended ? <span className="pw-popup__badge">Best value</span> : null}
          </div>
          <p className="pw-popup__head-sub">{plan.tagline}</p>
        </header>

        <div
          ref={bodyRef}
          className="pw-popup__body"
          tabIndex={0}
          role="region"
          aria-label={`${plan.name} plan details`}
        >
          <section
            ref={priceRef}
            tabIndex={-1}
            className={`pw-popup__price ${priceFlash ? "pw-popup__price--flash" : ""}`}
            aria-label={`${plan.name} pricing`}
          >
            <span className="pw-popup__price-amount">{plan.price}</span>
            <span className="pw-popup__price-period">per month</span>
            <span className="pw-popup__price-label">{plan.priceLabel}</span>
          </section>

          <p className="pw-popup__description">{plan.description}</p>

          <section className="pw-popup__features" aria-label={`Included in ${plan.name}`}>
            <h3>What&apos;s included</h3>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="pw-popup__supporting">Billing is not charged during this step.</p>

          {notice ? (
            <p className="pw-popup__notice" role="status">
              {notice}
            </p>
          ) : null}
        </div>

        <footer className="pw-popup__actions">
          <button
            ref={firstActionRef}
            type="button"
            className="pw-popup__action pw-popup__action--primary"
            onClick={onSelectPlan}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Processing…" : "Select this plan"}
          </button>
          <div className="pw-popup__actions-row">
            <button type="button" className="pw-popup__action" onClick={handleViewPrice} disabled={busy}>
              View price
            </button>
            <button type="button" className="pw-popup__action" onClick={onViewOtherPlans} disabled={busy}>
              View other plans
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wallet experience                                                    */
/* ------------------------------------------------------------------ */

function PlanWalletExperience({ context, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const plans = getPricingPlans();
  const { isAuthenticated, openRegister, saveUserPlan, refreshUser } = useAuth();

  const restored = useMemo(() => restoreFromLocation(location), [location]);
  const draft = useMemo(() => (user?.id ? readOnboardingDraft(user.id) : {}), [user?.id]);
  const cachedPlan = useMemo(() => (user?.id ? readCachedPlan(user.id) : null), [user?.id]);

  const initialPlanId =
    restored.selectedPlanId ||
    (isValidPlanId(draft.selectedPlanId)
      ? draft.selectedPlanId
      : isValidPlanId(cachedPlan)
        ? cachedPlan
        : null);

  const initialOpen = restored.walletOpen || Boolean(draft.walletOpen);
  const initialStatus = restored.detailsOpen && initialPlanId
    ? WALLET_STATES.POPUP_OPEN
    : initialOpen
      ? WALLET_STATES.OPEN
      : WALLET_STATES.CLOSED;

  const [state, dispatch] = useWalletMachine(
    {
      status: initialStatus,
      selectedPlanId: initialPlanId,
      popupPlanId: initialStatus === WALLET_STATES.POPUP_OPEN ? initialPlanId : null
    },
    reducedMotion
  );

  const [busyPlan, setBusyPlan] = useState(null);
  const [notice, setNotice] = useState("");
  const cardRefs = useRef({});
  const previousStatusRef = useRef(state.status);
  const allowGuestCheckout = import.meta.env.DEV || import.meta.env.VITE_ALLOW_GUEST_CHECKOUT === "true";

  const showDeck = walletShowsDeck(state.status);
  const selectable = cardsSelectable(state.status);
  const popupOpen = popupVisible(state.status);
  const popupPlan = state.popupPlanId ? getPlan(state.popupPlanId) : null;

  const persistDraft = useCallback(
    (patch) => {
      if (!user?.id) return;
      writeOnboardingDraft(user.id, patch);
    },
    [user?.id]
  );

  // Restore focus to the selected card when the popup fully closes.
  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = state.status;
    if (previous === WALLET_STATES.POPUP_CLOSING && state.status === WALLET_STATES.OPEN) {
      const ref = cardRefs.current[state.selectedPlanId];
      ref?.focus();
      setNotice("");
    }
  }, [state.status, state.selectedPlanId]);

  function handleWalletOpen() {
    if (state.status === WALLET_STATES.CLOSED) {
      dispatch({ type: "PRESS_WALLET" });
      persistDraft({ walletOpen: true, selectedPlanId: state.selectedPlanId });
    }
  }

  function handleWalletClose() {
    if (state.status !== WALLET_STATES.OPEN) return;
    dispatch({ type: "PRESS_WALLET" });
    persistDraft({ walletOpen: false, selectedPlanId: state.selectedPlanId });
  }

  function handleWalletControl() {
    if (state.status === WALLET_STATES.CLOSED) {
      handleWalletOpen();
      return;
    }
    handleWalletClose();
  }

  function handleSelectCard(planId) {
    if (!selectable) return;
    setNotice("");
    dispatch({ type: "SELECT_CARD", planId });
    persistDraft({ walletOpen: true, selectedPlanId: planId });
  }

  function handleViewOtherPlans() {
    dispatch({ type: "CLOSE_POPUP" });
  }

  async function handleChooseOnboarding(plan) {
    setNotice("");
    setBusyPlan(plan.id);
    try {
      await saveUserPlan(plan.id);
      await refreshUser();
      persistDraft({ selectedPlanId: plan.id, planConfirmed: true });
      navigate(MATCH_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setNotice(err.message || "Could not save your plan. Please try again.");
    } finally {
      setBusyPlan(null);
    }
  }

  async function handleChoosePublic(plan) {
    setNotice("");
    const requiresRealAccount = user?.authProvider === "demo" || user?.authProvider === "dev";

    if ((!isAuthenticated || requiresRealAccount) && !allowGuestCheckout) {
      setNotice("Create an account or sign in to choose this plan.");
      openRegister();
      return;
    }

    setBusyPlan(plan.id);
    try {
      const result = await startBillingCheckout(plan.id, {
        guestCheckout: !isAuthenticated || requiresRealAccount
      });
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setNotice("Plan checkout will turn on after billing is connected.");
      } else if (error.status === 401 || error.status === 403) {
        setNotice("Create an account or sign in to choose this plan.");
        openRegister();
      } else {
        setNotice(error.message || "Checkout is unavailable right now. Please try again.");
      }
    } finally {
      setBusyPlan(null);
    }
  }

  function handleSelectPlanAction() {
    if (!popupPlan || busyPlan) return;
    if (context === "onboarding") {
      handleChooseOnboarding(popupPlan);
    } else {
      handleChoosePublic(popupPlan);
    }
  }

  const walletControlDisabled =
    state.status !== WALLET_STATES.CLOSED &&
    state.status !== WALLET_STATES.OPEN;
  const walletControlLabel = state.status === WALLET_STATES.CLOSED ? "Open wallet" : "Close wallet";

  return (
    <div className="plan-wallet-experience">
      <div
        className={`pw-wallet pw-wallet--${state.status}`}
        data-deck-visible={showDeck ? "true" : "false"}
        data-popup-plan={popupPlan?.id || state.selectedPlanId || ""}
        aria-hidden={popupOpen ? "true" : undefined}
        // React 18 forwards unknown attributes as strings; "" enables inert.
        inert={popupOpen ? "" : undefined}
      >
        <div className="pw-wallet__interior" aria-hidden="true" />

        <div className="pw-deck" role="group" aria-label="Prelude plans">
          {plans.map((plan, index) => (
            <WalletPlanCard
              key={plan.id}
              plan={plan}
              index={index}
              selected={state.selectedPlanId === plan.id}
              selectable={selectable}
              onSelect={handleSelectCard}
              buttonRef={(node) => {
                cardRefs.current[plan.id] = node;
              }}
            />
          ))}
        </div>

        <div className="pw-wallet__pocket" aria-hidden="true">
          <span className="pw-wallet__pocket-lip" />
        </div>

        <WalletBrandFooter email={user?.email} />

        <button
          type="button"
          className="pw-wallet__control"
          onClick={handleWalletControl}
          disabled={walletControlDisabled}
          aria-expanded={showDeck}
          aria-label={`${walletControlLabel} the Prelude plan wallet`}
        >
          <span>{walletControlLabel}</span>
          <ChevronRight aria-hidden="true" />
        </button>

        <div className="pw-wallet__details-bridge" aria-hidden="true">
          <span className="pw-wallet__details-bridge-line" />
          <span className="pw-wallet__details-bridge-copy">
            Preparing details
            <ChevronRight aria-hidden="true" />
          </span>
        </div>
      </div>

      {popupOpen && popupPlan ? (
        <PlanPopup
          plan={popupPlan}
          status={state.status}
          busy={busyPlan === popupPlan.id}
          notice={notice}
          onSelectPlan={handleSelectPlanAction}
          onViewOtherPlans={handleViewOtherPlans}
          onRequestClose={handleViewOtherPlans}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page shells                                                          */
/* ------------------------------------------------------------------ */

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

function OnboardingPlanSelector() {
  const { user, ready } = useAuth();

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

  return (
    <OnboardingShell
      user={user}
      title="Choose your Prelude plan"
      subtitle="Open the wallet, compare the three tiers, and pick the mentorship level that fits your goals."
      eyebrow="Plan selection"
      hideContinue
      footerNote="Your selection is saved to your profile so Prelude can personalize your dashboard."
    >
      <PlanWalletExperience context="onboarding" user={user} />
    </OnboardingShell>
  );
}

export function PlansPage() {
  const { user } = useAuth();
  return (
    <PublicPlansShell>
      <PlanWalletExperience context="public" user={user} />
    </PublicPlansShell>
  );
}

/**
 * Legacy deep links (/plans/:planId and /onboarding/plan/:planId) now land on
 * the wallet with the matching plan popup already open.
 */
export function PlanDetailPage({ context = "public" }) {
  const { planId } = useParams();
  const { user, ready } = useAuth();

  if (!isValidPlanId(planId)) {
    return <Navigate to={`${selectorPath(context)}?wallet=open`} replace />;
  }

  if (context === "onboarding" && !ready) {
    return (
      <OnboardingShell user={user} loading title="Choose your plan" subtitle="Preparing your Prelude plan details…" hideContinue />
    );
  }

  if (context === "onboarding" && !user) {
    return <Navigate to="/login" replace state={{ from: `${PLAN_SELECTION_PATH}/${planId}` }} />;
  }

  if (context === "onboarding" && !userNeedsPlanSelection(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  return <Navigate to={`${selectorPath(context)}?wallet=open&selected=${planId}&details=open`} replace />;
}

export default OnboardingPlanSelector;
