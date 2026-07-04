import { useEffect, useRef } from "react";
import { createTimeline } from "animejs";
import { WALLET_STATES } from "./planWalletMachine.js";

const S = WALLET_STATES;

/** Timeline durations (ms). */
export const MOTION_MS = {
  open: 760,
  selectCard: 430,
  popupEnter: 520,
  popupExit: 280,
  close: 560
};

export const WALLET_EASE = "out(4)";
export const WALLET_EASES = {
  shell: "out(4)",
  card: "out(5)",
  settle: "outElastic(1, .72)",
  overlay: "inOut(2)",
  reverse: "inOut(3)"
};

export const WALLET_HEIGHT = {
  closed: "13.5rem",
  open: "29.5rem"
};

export const CARD_LAYOUT = {
  stepRem: 5.9,
  hiddenYRem: 13,
  hiddenScale: 0.95
};

export const CARD_VARIANTS = {
  hidden: { liftRem: 13, scale: 0.95, opacity: 0 },
  deck: { liftRem: 0, scale: 1, opacity: 1 },
  deckSelected: { liftRem: -0.55, scale: 1.015, opacity: 1 },
  selectingSelected: { liftRem: -0.82, scale: 1.022, opacity: 1 },
  popupSelected: { liftRem: -0.9, scale: 1.026, opacity: 1 },
  popupSibling: { liftRem: 0.18, scale: 0.992, opacity: 0.68 }
};

/**
 * Card Y offset from deck index + motion variant.
 * @param {number} index
 * @param {keyof typeof CARD_VARIANTS} variant
 * @param {number} [stepRem]
 */
export function cardMotionValues(index, variant = "deck", stepRem = CARD_LAYOUT.stepRem) {
  if (variant === "hidden") {
    return {
      y: `${CARD_LAYOUT.hiddenYRem}rem`,
      scale: CARD_LAYOUT.hiddenScale,
      opacity: 0
    };
  }
  const base = index * stepRem;
  const v = CARD_VARIANTS[variant] || CARD_VARIANTS.deck;
  return {
    y: `${base + v.liftRem}rem`,
    scale: v.scale,
    opacity: v.opacity
  };
}

/** Resolve card variant from wallet status + selection. */
export function cardVariantForStatus(status, planId, index, selectedPlanId, planIds) {
  if (status === S.CLOSED || status === S.CLOSING || status === S.OPENING) {
    return "hidden";
  }

  if (status === S.SELECTING_CARD) {
    return planId === selectedPlanId ? "selectingSelected" : "deck";
  }

  if (status === S.POPUP_OPENING || status === S.POPUP_OPEN || status === S.POPUP_CLOSING) {
    if (planId === selectedPlanId) return "popupSelected";
    if (selectedPlanId) return "popupSibling";
  }

  if (planId === selectedPlanId) return "deckSelected";
  return "deck";
}

export function settleEventForStatus(status) {
  switch (status) {
    case S.OPENING:
      return { type: "OPEN_SETTLED" };
    case S.SELECTING_CARD:
      return { type: "CARD_SETTLED" };
    case S.POPUP_OPENING:
      return { type: "POPUP_SETTLED" };
    case S.POPUP_CLOSING:
      return { type: "POPUP_CLOSED" };
    case S.CLOSING:
      return { type: "CLOSE_SETTLED" };
    default:
      return null;
  }
}

export function motionDuration(ms, reducedMotion) {
  return reducedMotion ? 0 : ms;
}

export function walletHeightForStatus(status) {
  if (
    status === S.OPENING ||
    status === S.OPEN ||
    status === S.SELECTING_CARD ||
    status === S.POPUP_OPENING ||
    status === S.POPUP_OPEN ||
    status === S.POPUP_CLOSING
  ) {
    return WALLET_HEIGHT.open;
  }
  return WALLET_HEIGHT.closed;
}

export function deckSheenOpacity(status) {
  return status === S.CLOSED || status === S.CLOSING ? 1 : 0;
}

function readWalletMetrics(walletEl) {
  if (!walletEl || typeof window === "undefined") {
    return { closed: WALLET_HEIGHT.closed, open: WALLET_HEIGHT.open, step: CARD_LAYOUT.stepRem };
  }
  const styles = getComputedStyle(walletEl);
  const closed = styles.getPropertyValue("--pw-closed-height").trim() || WALLET_HEIGHT.closed;
  const open = styles.getPropertyValue("--pw-open-height").trim() || WALLET_HEIGHT.open;
  const step = parseFloat(styles.getPropertyValue("--pw-card-step")) || CARD_LAYOUT.stepRem;
  return { closed, open, step };
}

function setInstant(el, props) {
  if (!el) return;
  createTimeline({ autoplay: false })
    .add(el, { ...props, duration: 0 })
    .complete(true);
}

function applyCardStates({ cardRefs, planIds, status, selectedPlanId, stepRem }) {
  planIds.forEach((planId, index) => {
    const el = cardRefs.current?.[planId];
    if (!el) return;
    const variant = cardVariantForStatus(status, planId, index, selectedPlanId, planIds);
    setInstant(el, cardMotionValues(index, variant, stepRem));
  });
}

function applyWalletShell({ refs, status, stepRem, planIds, selectedPlanId }) {
  setInstant(refs.walletRef.current, { height: walletHeightForStatus(status) });
  setInstant(refs.interiorRef.current, {
    "--pw-sheen-opacity": deckSheenOpacity(status)
  });
  setInstant(refs.controlRef.current, {
    opacity:
      status === S.POPUP_OPENING || status === S.POPUP_OPEN || status === S.POPUP_CLOSING ? 0 : 1
  });
  const bridgeVisible = status === S.POPUP_OPENING;
  setInstant(refs.bridgeRef.current, {
    opacity: bridgeVisible ? 1 : 0,
    y: bridgeVisible ? 0 : "0.5rem"
  });
  applyCardStates({ cardRefs: refs.cardRefs, planIds, status, selectedPlanId, stepRem });
}

function applyPopupShell({ refs, visible }) {
  const backdrop = refs.backdropRef.current;
  const popup = refs.popupRef.current;
  if (backdrop) setInstant(backdrop, { opacity: visible ? 1 : 0 });
  if (popup) {
    setInstant(popup, {
      opacity: visible ? 1 : 0,
      x: 0,
      y: visible ? 0 : "0.75rem",
      scale: visible ? 1 : 0.975
    });
  }
}

function getPopupOrigin(cardEl, popupEl) {
  if (!cardEl || !popupEl || typeof window === "undefined") {
    return { x: 0, y: "1.45rem", scale: 0.94 };
  }
  const card = cardEl.getBoundingClientRect();
  const popup = popupEl.getBoundingClientRect();
  if (!popup.width || !popup.height) {
    return { x: 0, y: "1.45rem", scale: 0.94 };
  }
  const cardCx = card.left + card.width / 2;
  const cardCy = card.top + card.height / 2;
  const popupCx = popup.left + popup.width / 2;
  const popupCy = popup.top + popup.height / 2;
  const scale = Math.min(card.width / popup.width, card.height / popup.height, 1);
  return {
    x: cardCx - popupCx,
    y: cardCy - popupCy,
    scale
  };
}

function cancelTimeline(timelineRef) {
  const active = timelineRef.current;
  if (!active) return;
  active.cancel();
  timelineRef.current = null;
}

function runTimeline(timelineRef, timeline, onComplete) {
  cancelTimeline(timelineRef);
  timelineRef.current = timeline;
  timeline.then(() => {
    if (timelineRef.current === timeline) timelineRef.current = null;
    onComplete?.();
  });
}

export function snapWalletLayout({ refs, status, selectedPlanId, planIds }) {
  const metrics = readWalletMetrics(refs.walletRef.current);
  applyWalletShell({ refs, status, stepRem: metrics.step, planIds, selectedPlanId });
  const popupVisible =
    status === S.POPUP_OPENING || status === S.POPUP_OPEN || status === S.POPUP_CLOSING;
  applyPopupShell({ refs, visible: popupVisible && status !== S.POPUP_CLOSING });
}

function runOpenTimeline({ refs, planIds, selectedPlanId, reducedMotion, timelineRef, dispatch }) {
  const metrics = readWalletMetrics(refs.walletRef.current);
  const duration = motionDuration(MOTION_MS.open, reducedMotion);

  applyCardStates({
    cardRefs: refs.cardRefs,
    planIds,
    status: S.CLOSED,
    selectedPlanId,
    stepRem: metrics.step
  });
  setInstant(refs.walletRef.current, { height: metrics.closed });
  setInstant(refs.interiorRef.current, { "--pw-sheen-opacity": 1 });

  if (duration === 0) {
    snapWalletLayout({ refs, status: S.OPEN, selectedPlanId, planIds });
    dispatch({ type: "OPEN_SETTLED" });
    return;
  }

  const tl = createTimeline({ defaults: { ease: WALLET_EASES.shell } });
  tl.add(refs.walletRef.current, {
    height: { from: metrics.closed, to: metrics.open },
    duration
  });
  tl.add(
    refs.interiorRef.current,
    { "--pw-sheen-opacity": { from: 1, to: 0 }, duration: duration * 0.35 },
    0
  );

  planIds.forEach((planId, index) => {
    const el = refs.cardRefs.current?.[planId];
    if (!el) return;
    const variant = selectedPlanId === planId ? "deckSelected" : "deck";
    const values = cardMotionValues(index, variant, metrics.step);
    tl.add(
      el,
      {
        y: { from: `${CARD_LAYOUT.hiddenYRem}rem`, to: values.y },
        scale: { from: CARD_LAYOUT.hiddenScale, to: values.scale },
        opacity: { from: 0, to: 1 },
        duration: duration * 0.82,
        ease: selectedPlanId === planId ? WALLET_EASES.settle : WALLET_EASES.card
      },
      80 + index * 55
    );
  });

  runTimeline(timelineRef, tl, () => dispatch({ type: "OPEN_SETTLED" }));
}

function runCloseTimeline({ refs, planIds, selectedPlanId, reducedMotion, timelineRef, dispatch }) {
  const metrics = readWalletMetrics(refs.walletRef.current);
  const duration = motionDuration(MOTION_MS.close, reducedMotion);

  if (duration === 0) {
    snapWalletLayout({ refs, status: S.CLOSED, selectedPlanId, planIds });
    dispatch({ type: "CLOSE_SETTLED" });
    return;
  }

  const tl = createTimeline({ defaults: { ease: WALLET_EASES.reverse } });
  planIds.forEach((planId, index) => {
    const el = refs.cardRefs.current?.[planId];
    if (!el) return;
    tl.add(
      el,
      {
        y: `${CARD_LAYOUT.hiddenYRem}rem`,
        scale: CARD_LAYOUT.hiddenScale,
        opacity: 0,
        duration: duration * 0.68,
        ease: WALLET_EASES.reverse
      },
      0
    );
  });
  tl.add(
    refs.walletRef.current,
    { height: { to: metrics.closed }, duration },
    duration * 0.35
  );
  tl.add(
    refs.interiorRef.current,
    { "--pw-sheen-opacity": { to: 1 }, duration: duration * 0.4 },
    duration * 0.55
  );

  runTimeline(timelineRef, tl, () => dispatch({ type: "CLOSE_SETTLED" }));
}

function runSelectTimeline({ refs, planIds, selectedPlanId, reducedMotion, timelineRef, dispatch }) {
  const metrics = readWalletMetrics(refs.walletRef.current);
  const duration = motionDuration(MOTION_MS.selectCard, reducedMotion);

  if (duration === 0) {
    snapWalletLayout({ refs, status: S.SELECTING_CARD, selectedPlanId, planIds });
    dispatch({ type: "CARD_SETTLED" });
    return;
  }

  const tl = createTimeline({ defaults: { ease: WALLET_EASES.card } });
  planIds.forEach((planId, index) => {
    const el = refs.cardRefs.current?.[planId];
    if (!el) return;
    const variant = cardVariantForStatus(S.SELECTING_CARD, planId, index, selectedPlanId, planIds);
    const values = cardMotionValues(index, variant, metrics.step);
    tl.add(
      el,
      {
        y: values.y,
        scale: values.scale,
        opacity: values.opacity,
        duration,
        ease: planId === selectedPlanId ? WALLET_EASES.settle : WALLET_EASES.card
      },
      0
    );
  });

  runTimeline(timelineRef, tl, () => dispatch({ type: "CARD_SETTLED" }));
}

function runPopupOpenTimeline({ refs, planIds, selectedPlanId, reducedMotion, timelineRef, dispatch }) {
  const metrics = readWalletMetrics(refs.walletRef.current);
  const duration = motionDuration(MOTION_MS.popupEnter, reducedMotion);
  const cardEl = refs.cardRefs.current?.[selectedPlanId];
  const popupEl = refs.popupRef.current;
  const origin = getPopupOrigin(cardEl, popupEl);

  setInstant(refs.backdropRef.current, { opacity: 0 });
  setInstant(popupEl, {
    opacity: 0,
    x: origin.x,
    y: origin.y,
    scale: origin.scale
  });

  if (duration === 0) {
    snapWalletLayout({ refs, status: S.POPUP_OPEN, selectedPlanId, planIds });
    dispatch({ type: "POPUP_SETTLED" });
    return;
  }

  const tl = createTimeline({ defaults: { ease: WALLET_EASES.shell } });
  tl.add(
    refs.backdropRef.current,
    { opacity: { from: 0, to: 1 }, duration: duration * 0.5, ease: WALLET_EASES.overlay },
    0
  );
  tl.add(refs.controlRef.current, { opacity: { to: 0 }, duration: duration * 0.24 }, 0);
  tl.add(
    refs.bridgeRef.current,
    { opacity: { from: 0, to: 1 }, y: { from: "0.5rem", to: 0 }, duration: duration * 0.42 },
    duration * 0.04
  );

  planIds.forEach((planId, index) => {
    const el = refs.cardRefs.current?.[planId];
    if (!el) return;
    const variant = cardVariantForStatus(S.POPUP_OPENING, planId, index, selectedPlanId, planIds);
    const values = cardMotionValues(index, variant, metrics.step);
    tl.add(
      el,
      {
        y: values.y,
        scale: values.scale,
        opacity: values.opacity,
        duration: duration * 0.7,
        ease: planId === selectedPlanId ? WALLET_EASES.settle : WALLET_EASES.card
      },
      0
    );
  });

  tl.add(
    popupEl,
    {
      opacity: { from: 0, to: 1 },
      x: { from: origin.x, to: 0 },
      y: { from: origin.y, to: 0 },
      scale: { from: origin.scale, to: 1 },
      duration,
      ease: WALLET_EASES.settle
    },
    duration * 0.04
  );

  runTimeline(timelineRef, tl, () => dispatch({ type: "POPUP_SETTLED" }));
}

function runPopupCloseTimeline({ refs, planIds, selectedPlanId, reducedMotion, timelineRef, dispatch }) {
  const metrics = readWalletMetrics(refs.walletRef.current);
  const duration = motionDuration(MOTION_MS.popupExit, reducedMotion);

  if (duration === 0) {
    snapWalletLayout({ refs, status: S.OPEN, selectedPlanId, planIds });
    dispatch({ type: "POPUP_CLOSED" });
    return;
  }

  const tl = createTimeline({ defaults: { ease: WALLET_EASES.reverse } });
  tl.add(
    refs.popupRef.current,
    {
      opacity: { to: 0 },
      y: { to: "0.75rem" },
      scale: { to: 0.975 },
      duration,
      ease: WALLET_EASES.reverse
    },
    0
  );
  tl.add(refs.backdropRef.current, { opacity: { to: 0 }, duration: duration * 0.85, ease: WALLET_EASES.overlay }, 0);
  tl.add(
    refs.bridgeRef.current,
    { opacity: { to: 0 }, y: { to: "0.5rem" }, duration: duration * 0.5 },
    0
  );
  tl.add(refs.controlRef.current, { opacity: { to: 1 }, duration: duration * 0.45 }, duration * 0.2);

  planIds.forEach((planId, index) => {
    const el = refs.cardRefs.current?.[planId];
    if (!el) return;
    const variant = cardVariantForStatus(S.OPEN, planId, index, selectedPlanId, planIds);
    const values = cardMotionValues(index, variant, metrics.step);
    tl.add(
      el,
      {
        y: values.y,
        scale: values.scale,
        opacity: values.opacity,
        duration: duration * 0.72,
        ease: WALLET_EASES.reverse
      },
      duration * 0.1
    );
  });

  runTimeline(timelineRef, tl, () => dispatch({ type: "POPUP_CLOSED" }));
}

const TIMELINE_RUNNERS = {
  [S.OPENING]: runOpenTimeline,
  [S.CLOSING]: runCloseTimeline,
  [S.SELECTING_CARD]: runSelectTimeline,
  [S.POPUP_OPENING]: runPopupOpenTimeline,
  [S.POPUP_CLOSING]: runPopupCloseTimeline
};

/**
 * Drive wallet/card/popup motion from machine status via anime.js timelines.
 */
export function usePlanWalletMotion({
  status,
  selectedPlanId,
  reducedMotion,
  refs,
  dispatch,
  planIds,
  skipInitialMotion = false
}) {
  const timelineRef = useRef(null);
  const skipRef = useRef(skipInitialMotion);

  useEffect(() => {
    return () => cancelTimeline(timelineRef);
  }, []);

  useEffect(() => {
    cancelTimeline(timelineRef);

    if (skipRef.current) {
      skipRef.current = false;
      snapWalletLayout({ refs, status, selectedPlanId, planIds });
      return;
    }

    const runner = TIMELINE_RUNNERS[status];
    if (runner) {
      runner({ refs, planIds, selectedPlanId, reducedMotion, timelineRef, dispatch });
      return;
    }

    snapWalletLayout({ refs, status, selectedPlanId, planIds });
  }, [status, selectedPlanId, reducedMotion, dispatch, planIds, refs]);
}
