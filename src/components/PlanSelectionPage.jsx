import { Check, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  PAYMENT_ONBOARDING_PATH,
  PLAN_SELECTION_PATH,
  isValidPlanId,
  postAuthDestination,
  userNeedsPaymentStep,
  userNeedsPlanSelection
} from "../lib/onboardingRoutes.js";
import { readCachedPlan } from "../lib/supabaseAuth.js";
import { getPlan, getPricingPlans } from "../lib/plans.js";
import { readOnboardingDraft, writeOnboardingDraft } from "../lib/onboardingFlow.js";
import { startBillingCheckout, startBundleCheckout } from "../lib/auth.js";
import { markPendingCheckoutPlan, startOnboardingBillingCheckout } from "../lib/onboardingPayment.js";
import {
  WALLET_STATES,
  cardsSelectable,
  createWalletState,
  popupVisible,
  walletReducer,
  walletShowsDeck
} from "../lib/planWalletMachine.js";
import {
  backDispatchForStatus,
  shouldCloseWalletAfterPopup,
  shouldNavigateAfterClose,
  resolveBackStep
} from "../lib/planWalletBack.js";
import { usePlanWalletMotion } from "../lib/planWalletMotion.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import {
  clearPendingBundleIntent,
  peekPendingBundleIntent
} from "../lib/bundlePurchaseIntent.js";
import {
  BUNDLE_IDS,
  formatUsd,
  getDefaultBundleSelection,
  isValidBundleId,
  listSupportBundles,
  normalizeBundleSelection,
  resolveBundleId,
  SUPPORT_BUNDLES
} from "../../shared/supportBundles.js";
import BundleCustomizePopup from "./BundleCustomizePopup.jsx";
import OnboardingShell from "./onboarding/OnboardingShell.jsx";

const PUBLIC_PLANS_PATH = "/plans";
const logoSrc = `${import.meta.env.BASE_URL}media/prelude-logo.png`;

function selectorPath(context) {
  if (context === "payment") return PAYMENT_ONBOARDING_PATH;
  if (context === "onboarding") return PLAN_SELECTION_PATH;
  return PUBLIC_PLANS_PATH;
}

function restoreFromLocation(location) {
  const search = new URLSearchParams(location.search);
  const selected = location.state?.selectedPlanId || search.get("selected");
  const pending = peekPendingBundleIntent();
  const bundleParam = resolveBundleId(
    location.state?.bundleId || search.get("bundle") || pending?.bundleId || null
  );
  const modeParam = location.state?.purchaseMode || search.get("mode") || pending?.mode || null;
  const purchaseMode =
    modeParam === "bundles" || (!modeParam && isValidBundleId(bundleParam)) ? "bundles" : "monthly";
  const bundleId = isValidBundleId(bundleParam) ? resolveBundleId(bundleParam) : null;

  return {
    walletOpen:
      Boolean(location.state?.walletOpen) ||
      search.get("wallet") === "open" ||
      Boolean(bundleId && purchaseMode === "bundles"),
    detailsOpen:
      search.get("details") === "open" ||
      Boolean(location.state?.detailsOpen) ||
      Boolean(bundleId && purchaseMode === "bundles"),
    selectedPlanId: isValidPlanId(selected) ? selected : null,
    purchaseMode,
    bundleId
  };
}

/* ------------------------------------------------------------------ */
/* Wallet pieces                                                        */
/* ------------------------------------------------------------------ */

export function WalletBrandFooter({ email }) {
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

export function WalletPlanCard({
  plan,
  index,
  selected,
  selectable,
  onSelect,
  buttonRef,
  style,
  displayOnly = false
}) {
  const className = `pw-card pw-card--${plan.id} ${selected ? "pw-card--selected" : ""}`;
  const cardStyle = { "--pw-i": index, ...style };

  const content = (
    <>
      <span className="pw-card__surface" aria-hidden="true" />
      <span className="pw-card__sheen" aria-hidden="true" />
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
    </>
  );

  if (displayOnly) {
    return (
      <article
        className={className}
        style={cardStyle}
        aria-label={`${plan.name} plan, ${plan.price} per month${selected ? ", current plan" : ""}`}
      >
        {content}
      </article>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      style={cardStyle}
      onClick={() => onSelect(plan.id)}
      disabled={!selectable}
      aria-haspopup="dialog"
      aria-pressed={selected}
      aria-label={`${plan.name} plan, ${plan.price} per month${selected ? ", selected" : ""}`}
      tabIndex={selectable ? 0 : -1}
    >
      {content}
    </button>
  );
}

export function WalletBundleCard({
  catalog,
  index,
  selected,
  selectable,
  onSelect,
  buttonRef
}) {
  const className = `pw-card pw-card--bundle pw-card--${catalog.id} ${selected ? "pw-card--selected" : ""}`;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      style={{ "--pw-i": index }}
      onClick={() => onSelect(catalog.id)}
      disabled={!selectable}
      aria-haspopup="dialog"
      aria-pressed={selected}
      aria-label={`${catalog.shortTitle || catalog.title}, starting at ${formatUsd(catalog.startingCents)}${selected ? ", selected" : ""}`}
      tabIndex={selectable ? 0 : -1}
    >
      <span className="pw-card__surface" aria-hidden="true" />
      <span className="pw-card__sheen" aria-hidden="true" />
      <span className="pw-card__top">
        <span className="pw-card__name">{catalog.shortTitle || catalog.title}</span>
        {catalog.badge ? <span className="pw-card__badge">{catalog.badge}</span> : null}
        <span className="pw-card__price">
          {formatUsd(catalog.startingCents)}
          <small>starting</small>
        </span>
      </span>
      <span className="pw-card__tagline">{catalog.shortDescription || catalog.description}</span>
      <span className="pw-card__bundle-action">
        Customize
        <ChevronRight aria-hidden="true" />
      </span>
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

export function PlanDetailsPanel({ plan, className = "", supporting }) {
  return (
    <article
      className={`pw-popup pw-popup--${plan.id} pw-popup--inline ${className}`.trim()}
      aria-label={`${plan.name} plan details`}
    >
      <header className="pw-popup__head">
        <div className="pw-popup__head-row">
          <h2>{plan.name}</h2>
          {plan.isRecommended ? <span className="pw-popup__badge">Best value</span> : null}
        </div>
        <p className="pw-popup__head-sub">{plan.tagline}</p>
      </header>

      <div className="pw-popup__body" role="region" aria-label={`Included in ${plan.name}`}>
        <section className="pw-popup__price" aria-label={`${plan.name} pricing`}>
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

        {supporting ? <p className="pw-popup__supporting">{supporting}</p> : null}
      </div>
    </article>
  );
}

export function PlanPopup({
  plan,
  status,
  busy,
  notice,
  context = "public",
  dialogRef,
  backdropRef,
  onSelectPlan,
  onViewOtherPlans,
  onRequestClose
}) {
  const isPayment = context === "payment";
  const isBilling = context === "billing";
  const isBillingCurrent = context === "billing-current";
  const bodyRef = useRef(null);
  const priceRef = useRef(null);
  const firstActionRef = useRef(null);
  const [priceFlash, setPriceFlash] = useState(false);
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
    <div className="pw-popup-layer" onKeyDown={handleKeyDown}>
      <div
        ref={backdropRef}
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

          <p className="pw-popup__supporting">
            {isPayment
              ? "You'll be redirected to Stripe's secure payment portal. Your account activates after payment is confirmed."
              : isBillingCurrent
                ? "This is your active Prelude mentorship tier. Use Compare plans below to review other tiers."
              : isBilling
                ? "You'll be redirected to Stripe to confirm your plan change. Your new rate applies on your next billing cycle."
                : "Billing is not charged during this step."}
          </p>

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
            disabled={busy || isBillingCurrent}
            aria-busy={busy}
          >
            {busy
              ? "Processing…"
              : isPayment
                ? "Continue to checkout"
                : isBillingCurrent
                  ? "Current plan"
                  : isBilling
                    ? "Switch to this plan"
                    : "Select this plan"}
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

export function PlanWalletExperience({
  context,
  user,
  backTo = "/",
  onRegisterBack,
  plans: plansProp,
  initialSelectedPlanId = null,
  initialWalletOpen = false,
  persistState = true,
  experienceClassName = ""
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const plans = plansProp ?? getPricingPlans();
  const { isAuthenticated, openRegister, saveUserPlan, refreshUser } = useAuth();
  const isBillingContext = context === "billing" || context === "billing-current";

  const restored = useMemo(() => restoreFromLocation(location), [location]);
  const draft = useMemo(
    () => (persistState && user?.id ? readOnboardingDraft(user.id) : {}),
    [persistState, user?.id]
  );
  const cachedPlan = useMemo(
    () => (persistState && user?.id ? readCachedPlan(user.id) : null),
    [persistState, user?.id]
  );

  const supportBundles = useMemo(() => listSupportBundles(), []);
  const [purchaseMode, setPurchaseMode] = useState(() => {
    if (isBillingContext) return "monthly";
    if (restored.purchaseMode === "bundles") return "bundles";
    if (draft.purchaseMode === "bundles") return "bundles";
    return "monthly";
  });

  const initialMonthlyPlanId = isBillingContext
    ? isValidPlanId(initialSelectedPlanId)
      ? initialSelectedPlanId
      : null
    : restored.selectedPlanId ||
      (isValidPlanId(draft.selectedPlanId)
        ? draft.selectedPlanId
        : isValidPlanId(cachedPlan)
          ? cachedPlan
          : null);

  const initialBundleId =
    restored.bundleId ||
    (isValidBundleId(draft.selectedBundleId)
      ? resolveBundleId(draft.selectedBundleId)
      : supportBundles[0]?.id) ||
    null;

  const initialPlanId = purchaseMode === "bundles" ? initialBundleId : initialMonthlyPlanId;

  const initialOpen = isBillingContext
    ? initialWalletOpen
    : restored.walletOpen || Boolean(draft.walletOpen) || purchaseMode === "bundles";
  const initialStatus = isBillingContext
    ? initialOpen
      ? WALLET_STATES.OPEN
      : WALLET_STATES.CLOSED
    : restored.detailsOpen && initialPlanId && purchaseMode === "bundles"
      ? WALLET_STATES.POPUP_OPEN
      : restored.detailsOpen && initialPlanId && purchaseMode === "monthly"
        ? WALLET_STATES.POPUP_OPEN
        : initialOpen
          ? WALLET_STATES.OPEN
          : WALLET_STATES.CLOSED;

  const planIds = useMemo(
    () => (purchaseMode === "bundles" ? supportBundles.map((bundle) => bundle.id) : plans.map((plan) => plan.id)),
    [plans, purchaseMode, supportBundles]
  );

  const [bundleSelections, setBundleSelections] = useState(() => {
    const fromDraft = draft.bundleSelections && typeof draft.bundleSelections === "object" ? draft.bundleSelections : {};
    return Object.fromEntries(
      BUNDLE_IDS.map((id) => {
        const defaults = getDefaultBundleSelection(id);
        const saved = fromDraft[id];
        if (!saved || typeof saved !== "object") return [id, defaults];
        const merged = {
          ...defaults,
          ...saved,
          bundleId: id,
          quantities: { ...defaults.quantities, ...saved.quantities },
          addOns: { ...defaults.addOns, ...saved.addOns },
          services: { ...defaults.services, ...saved.services },
          sessionUses: { ...defaults.sessionUses, ...saved.sessionUses }
        };
        const normalized = normalizeBundleSelection(merged, { snapInvalidQuantities: true });
        return [id, normalized.ok ? normalized.selection : defaults];
      })
    );
  });

  const walletRef = useRef(null);
  const interiorRef = useRef(null);
  const pocketRef = useRef(null);
  const controlRef = useRef(null);
  const bridgeRef = useRef(null);
  const popupRef = useRef(null);
  const backdropRef = useRef(null);
  const cardRefs = useRef({});
  const lastMonthlySelectedRef = useRef(initialMonthlyPlanId);
  const lastBundleSelectedRef = useRef(initialBundleId);

  const motionRefs = useMemo(
    () => ({
      walletRef,
      interiorRef,
      pocketRef,
      controlRef,
      bridgeRef,
      popupRef,
      backdropRef,
      cardRefs
    }),
    []
  );

  const [state, dispatch] = useReducer(walletReducer, {
    status: initialStatus,
    selectedPlanId: initialPlanId,
    popupPlanId: initialStatus === WALLET_STATES.POPUP_OPEN ? initialPlanId : null
  }, createWalletState);

  const skipInitialMotion =
    initialStatus === WALLET_STATES.OPEN ||
    initialStatus === WALLET_STATES.POPUP_OPEN ||
    initialStatus === WALLET_STATES.CLOSED;

  usePlanWalletMotion({
    status: state.status,
    selectedPlanId: state.selectedPlanId,
    reducedMotion,
    refs: motionRefs,
    dispatch,
    planIds,
    skipInitialMotion
  });

  const [busyPlan, setBusyPlan] = useState(null);
  const [notice, setNotice] = useState("");
  const previousStatusRef = useRef(state.status);
  const pendingBackRef = useRef(false);
  const allowGuestCheckout = import.meta.env.DEV || import.meta.env.VITE_ALLOW_GUEST_CHECKOUT === "true";

  const showDeck = walletShowsDeck(state.status);
  const selectable = cardsSelectable(state.status);
  const popupOpen = popupVisible(state.status);
  const popupPlan = purchaseMode === "monthly" && state.popupPlanId ? getPlan(state.popupPlanId) : null;
  const popupBundleId =
    purchaseMode === "bundles" && isValidBundleId(state.popupPlanId)
      ? resolveBundleId(state.popupPlanId)
      : null;

  useEffect(() => {
    if (isBillingContext) return;
    if (peekPendingBundleIntent()) clearPendingBundleIntent();
  }, [isBillingContext]);

  useEffect(() => {
    if (purchaseMode === "monthly" && isValidPlanId(state.selectedPlanId)) {
      lastMonthlySelectedRef.current = state.selectedPlanId;
    }
    if (purchaseMode === "bundles" && isValidBundleId(state.selectedPlanId)) {
      lastBundleSelectedRef.current = state.selectedPlanId;
    }
  }, [purchaseMode, state.selectedPlanId]);

  const persistDraft = useCallback(
    (patch) => {
      if (!persistState || !user?.id) return;
      writeOnboardingDraft(user.id, patch);
    },
    [persistState, user?.id]
  );

  function handlePurchaseModeChange(nextMode) {
    if (nextMode === purchaseMode || context === "billing-current") return;
    if (popupOpen) {
      dispatch({ type: "CLOSE_POPUP" });
    }
    setPurchaseMode(nextMode);
    const nextSelected =
      nextMode === "bundles"
        ? lastBundleSelectedRef.current || supportBundles[0]?.id || null
        : lastMonthlySelectedRef.current || plans[0]?.id || null;
    persistDraft({
      purchaseMode: nextMode,
      walletOpen: true,
      selectedBundleId: nextMode === "bundles" ? nextSelected : lastBundleSelectedRef.current,
      selectedPlanId: nextMode === "monthly" ? nextSelected : lastMonthlySelectedRef.current
    });
    cardRefs.current = {};
    dispatch({ type: "SWAP_DECK", planId: nextSelected });
  }

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

  const handleBackRequest = useCallback(
    (event) => {
      event?.preventDefault?.();

      if (resolveBackStep(state.status) === "navigate") {
        navigate(backTo);
        return;
      }

      pendingBackRef.current = true;
      const action = backDispatchForStatus(state.status);
      if (action?.type === "PRESS_WALLET") {
        persistDraft({ walletOpen: false, selectedPlanId: state.selectedPlanId });
      }
      if (action) dispatch(action);
    },
    [backTo, dispatch, navigate, persistDraft, state.selectedPlanId, state.status]
  );

  useEffect(() => {
    if (isBillingContext) return undefined;
    onRegisterBack?.(handleBackRequest);
    return () => onRegisterBack?.(null);
  }, [handleBackRequest, isBillingContext, onRegisterBack]);

  useEffect(() => {
    if (isBillingContext || !pendingBackRef.current) return;

    if (shouldNavigateAfterClose(state.status, pendingBackRef.current)) {
      pendingBackRef.current = false;
      navigate(backTo);
      return;
    }

    if (shouldCloseWalletAfterPopup(state.status, pendingBackRef.current)) {
      dispatch({ type: "PRESS_WALLET" });
      persistDraft({ walletOpen: false, selectedPlanId: state.selectedPlanId });
      return;
    }

    const action = backDispatchForStatus(state.status);
    if (action) dispatch(action);
  }, [backTo, dispatch, isBillingContext, navigate, persistDraft, state.selectedPlanId, state.status]);

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
    if (purchaseMode === "bundles") {
      persistDraft({ walletOpen: true, selectedBundleId: planId, purchaseMode: "bundles" });
    } else {
      persistDraft({ walletOpen: true, selectedPlanId: planId, purchaseMode: "monthly" });
    }
  }

  function handleViewOtherPlans() {
    dispatch({ type: "CLOSE_POPUP" });
  }

  function handleBundleSelectionChange(nextSelection) {
    if (!nextSelection?.bundleId) return;
    setBundleSelections((current) => {
      const updated = { ...current, [nextSelection.bundleId]: nextSelection };
      persistDraft({ bundleSelections: updated, selectedBundleId: nextSelection.bundleId });
      return updated;
    });
  }

  async function handleChooseBundle(selection) {
    setNotice("");
    const requiresRealAccount = user?.authProvider === "demo" || user?.authProvider === "dev";

    if (context === "billing-current") return;

    if (context === "public" && (!isAuthenticated || requiresRealAccount) && !allowGuestCheckout) {
      setNotice("Create an account or sign in to purchase this bundle.");
      openRegister();
      return;
    }

    setBusyPlan(selection.bundleId);
    try {
      const result = await startBundleCheckout(selection, {
        context: context === "payment" ? "onboarding" : "public",
        guestCheckout:
          context === "public" && (!isAuthenticated || requiresRealAccount)
      });
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setNotice("Bundle checkout will turn on after billing is connected.");
      } else if (error.status === 401 || error.status === 403) {
        setNotice("Create an account or sign in to continue to checkout.");
        openRegister();
      } else {
        setNotice(error.message || "Bundle checkout is unavailable right now. Please try again.");
      }
    } finally {
      setBusyPlan(null);
    }
  }

  async function handleChooseOnboarding(plan) {
    setNotice("");
    setBusyPlan(plan.id);
    try {
      await saveUserPlan(plan.id);
      await refreshUser();
      persistDraft({ selectedPlanId: plan.id, planConfirmed: true });
      navigate(postAuthDestination(user), { replace: true });
    } catch (err) {
      setNotice(err.message || "Could not save your plan. Please try again.");
    } finally {
      setBusyPlan(null);
    }
  }

  async function handleChoosePayment(plan) {
    setNotice("");
    setBusyPlan(plan.id);
    try {
      if (user?.id) {
        await markPendingCheckoutPlan(user.id, plan.id);
        persistDraft({ selectedPlanId: plan.id, checkoutStarted: true });
      }
      const result = await startOnboardingBillingCheckout(plan.id);
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setNotice("Checkout is not connected yet. Please try again once billing is configured.");
      } else if (error.status === 401 || error.status === 403) {
        setNotice("Your session expired. Sign in again and retry checkout.");
      } else {
        setNotice(error.message || "Checkout is unavailable right now. Please try again.");
      }
    } finally {
      setBusyPlan(null);
    }
  }

  async function handleChooseBilling(plan) {
    setNotice("");
    setBusyPlan(plan.id);
    try {
      const result = await startBillingCheckout(plan.id);
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setNotice("Plan checkout will turn on after billing is connected.");
      } else {
        setNotice(error.message || "Checkout is unavailable right now. Please try again.");
      }
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
    if (context === "billing-current") return;
    if (context === "payment") {
      handleChoosePayment(popupPlan);
    } else if (context === "onboarding") {
      handleChooseOnboarding(popupPlan);
    } else if (context === "billing") {
      handleChooseBilling(popupPlan);
    } else {
      handleChoosePublic(popupPlan);
    }
  }

  const walletControlDisabled =
    state.status !== WALLET_STATES.CLOSED &&
    state.status !== WALLET_STATES.OPEN;
  const walletControlLabel = state.status === WALLET_STATES.CLOSED ? "Open wallet" : "Close wallet";
  const deckCount = purchaseMode === "bundles" ? supportBundles.length : plans.length;
  const showModeSwitch = context !== "billing-current";

  return (
    <div className={`plan-wallet-experience ${experienceClassName}`.trim()}>
      {showModeSwitch ? (
        <div className="pw-mode-switch" role="tablist" aria-label="Purchase type">
          <button
            type="button"
            role="tab"
            className={`pw-mode-switch__tab${purchaseMode === "monthly" ? " pw-mode-switch__tab--active" : ""}`}
            aria-selected={purchaseMode === "monthly"}
            onClick={() => handlePurchaseModeChange("monthly")}
          >
            Monthly Plans
          </button>
          <button
            type="button"
            role="tab"
            className={`pw-mode-switch__tab${purchaseMode === "bundles" ? " pw-mode-switch__tab--active" : ""}`}
            aria-selected={purchaseMode === "bundles"}
            onClick={() => handlePurchaseModeChange("bundles")}
          >
            One-Time Bundles
          </button>
        </div>
      ) : null}

      <div
        ref={walletRef}
        className={`pw-wallet pw-wallet--${state.status} pw-wallet--count-${deckCount}${purchaseMode === "bundles" ? " pw-wallet--bundles" : ""}`}
        data-deck-visible={showDeck ? "true" : "false"}
        data-popup-plan={popupBundleId || popupPlan?.id || state.selectedPlanId || ""}
        aria-hidden={popupOpen ? "true" : undefined}
        // React 18 forwards unknown attributes as strings; "" enables inert.
        inert={popupOpen ? "" : undefined}
      >
        <div ref={interiorRef} className="pw-wallet__interior" aria-hidden="true" />

        <div
          className="pw-deck"
          role="group"
          aria-label={purchaseMode === "bundles" ? "Prelude one-time bundles" : "Prelude plans"}
          key={purchaseMode}
        >
          {purchaseMode === "bundles"
            ? supportBundles.map((bundle, index) => (
                <WalletBundleCard
                  key={bundle.id}
                  catalog={SUPPORT_BUNDLES[bundle.id]}
                  index={index}
                  selected={state.selectedPlanId === bundle.id}
                  selectable={selectable}
                  onSelect={handleSelectCard}
                  buttonRef={(node) => {
                    cardRefs.current[bundle.id] = node;
                  }}
                />
              ))
            : plans.map((plan, index) => (
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

        <div ref={pocketRef} className="pw-wallet__pocket" aria-hidden="true">
          <span className="pw-wallet__pocket-lip" />
        </div>

        <WalletBrandFooter email={user?.email} />

        <button
          ref={controlRef}
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

        <div ref={bridgeRef} className="pw-wallet__details-bridge" aria-hidden="true">
          <span className="pw-wallet__details-bridge-line" />
          <span className="pw-wallet__details-bridge-copy">
            Preparing details
            <ChevronRight aria-hidden="true" />
          </span>
        </div>
      </div>

      {popupOpen && popupBundleId ? (
        <BundleCustomizePopup
          bundleId={popupBundleId}
          selection={bundleSelections[popupBundleId]}
          onSelectionChange={handleBundleSelectionChange}
          status={state.status}
          busy={busyPlan === popupBundleId}
          notice={notice}
          context={context}
          dialogRef={popupRef}
          backdropRef={backdropRef}
          onCheckout={handleChooseBundle}
          onViewOtherBundles={handleViewOtherPlans}
          onRequestClose={handleViewOtherPlans}
        />
      ) : null}

      {popupOpen && popupPlan ? (
        <PlanPopup
          plan={popupPlan}
          status={state.status}
          busy={busyPlan === popupPlan.id}
          notice={notice}
          context={context}
          dialogRef={popupRef}
          backdropRef={backdropRef}
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

function PublicPlansShell({ children, onBack }) {
  return (
    <main className="plans-flow">
      <div className="plans-flow__inner">
        {onBack ? (
          <button type="button" className="plans-flow__home-link" onClick={onBack}>
            ← Back to Prelude
          </button>
        ) : (
          <Link to="/" className="plans-flow__home-link">
            ← Back to Prelude
          </Link>
        )}
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

export const PlanWalletSelector = PlanWalletExperience;

export function PlansPage() {
  const { user } = useAuth();
  const walletBackRef = useRef(null);

  return (
    <PublicPlansShell onBack={() => walletBackRef.current?.()}>
      <PlanWalletExperience
        context="public"
        user={user}
        backTo="/"
        onRegisterBack={(handler) => {
          walletBackRef.current = handler;
        }}
      />
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

  if (context === "payment" && !ready) {
    return (
      <OnboardingShell
        user={user}
        loading
        title="Choose your plan"
        subtitle="Preparing secure checkout…"
        hideContinue
        hideHomeLink
      />
    );
  }

  if (context === "payment" && !user) {
    return <Navigate to="/login" replace state={{ from: `${PAYMENT_ONBOARDING_PATH}/${planId}` }} />;
  }

  if (context === "payment" && !userNeedsPaymentStep(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  return <Navigate to={`${selectorPath(context)}?wallet=open&selected=${planId}&details=open`} replace />;
}

export default OnboardingPlanSelector;
