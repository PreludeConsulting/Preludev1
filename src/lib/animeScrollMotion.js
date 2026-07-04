import { animate, createTimeline, stagger } from "animejs";
import { onScroll } from "animejs/events";

/**
 * Shared anime.js v4 scroll-animation helpers.
 * Tier 1: calm enter reveals. Tier 2: multi-property / elastic / set-piece timelines.
 * Only transform + opacity are animated.
 */

export const TIER1_DEFAULTS = {
  enterDuration: 620,
  enterDistancePx: 24,
  staggerMs: 80,
  ease: "out(3)"
};

export const TIER2_DEFAULTS = {
  enterDuration: 780,
  enterDistancePx: 40,
  staggerMs: 110,
  staggerElasticMs: [0, 90, 160, 240, 340],
  springEase: "outElastic(1, 0.62)",
  popEase: "out(4)",
  lineStaggerMs: 70
};

/** Gate anime.js ScrollObserver debug markers — off by default, even in dev. */
export const SCROLL_OBSERVER_DEBUG =
  import.meta.env.DEV && import.meta.env.VITE_SCROLL_DEBUG === "true";

/** @deprecated Use TIER1_DEFAULTS */
export const SCROLL_MOTION = TIER1_DEFAULTS;

const REVERT_NOOP = { revert() {} };
const REVEAL_SAFETY_MS = 2400;

export function isElementInViewport(el) {
  if (!el || typeof window === "undefined") return false;
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function scheduleRevealSafety(el, { delay = 0, duration = TIER1_DEFAULTS.enterDuration, extraMs = 400 } = {}) {
  if (!el || typeof window === "undefined") return () => {};
  const timeoutId = window.setTimeout(() => {
    if (el?.style?.opacity !== "0" && getComputedStyle(el).opacity !== "0") return;
    if (isElementInViewport(el)) snapEnterFinalState(el);
  }, delay + duration + extraMs);
  return () => window.clearTimeout(timeoutId);
}

function wrapRevealHandle(handle, clearSafety) {
  return {
    revert() {
      clearSafety?.();
      handle.revert?.();
    }
  };
}

export function enterFinalState() {
  return { opacity: "1", transform: "none" };
}

export function enterHiddenState(distancePx = TIER1_DEFAULTS.enterDistancePx) {
  return { opacity: "0", transform: `translateY(${distancePx}px)` };
}

export function enterHiddenStateScaled(distancePx = TIER2_DEFAULTS.enterDistancePx, scale = 0.92) {
  return { opacity: "0", transform: `translateY(${distancePx}px) scale(${scale})` };
}

export function applyStyles(el, styles) {
  if (!el) return;
  Object.entries(styles).forEach(([key, value]) => {
    el.style[key] = value;
  });
}

export function snapEnterFinalState(el, children = []) {
  applyStyles(el, enterFinalState());
  children.filter(Boolean).forEach((child) => applyStyles(child, enterFinalState()));
}

export function buildEnterScrollOptions(target, { debug = false } = {}) {
  return {
    target,
    enter: "bottom-=10% top",
    leave: "top bottom",
    // One-shot enter: play on scroll-in, do not pause on scroll-out.
    sync: "play",
    repeat: false,
    debug
  };
}

export function buildScrubScrollOptions(target, { debug = false } = {}) {
  return {
    target,
    enter: "top bottom",
    leave: "bottom top",
    sync: true,
    debug
  };
}

function revertAll(...handles) {
  handles.filter(Boolean).forEach((handle) => handle.revert?.());
}

/**
 * Trigger-on-enter reveal for a single element.
 * @returns {{ revert: () => void }}
 */
export function createEnterReveal(
  el,
  { reducedMotion = false, debug = false, delay = 0, distancePx, duration } = {}
) {
  if (!el) return REVERT_NOOP;

  const dist = distancePx ?? TIER1_DEFAULTS.enterDistancePx;
  const dur = duration ?? TIER1_DEFAULTS.enterDuration;

  if (reducedMotion) {
    snapEnterFinalState(el);
    return REVERT_NOOP;
  }

  applyStyles(el, enterHiddenState(dist));

  const animation = animate(el, {
    opacity: [0, 1],
    translateY: [dist, 0],
    duration: dur,
    delay,
    ease: TIER1_DEFAULTS.ease,
    autoplay: onScroll(buildEnterScrollOptions(el, { debug }))
  });

  const clearSafety = scheduleRevealSafety(el, { delay, duration: dur });
  return wrapRevealHandle({ revert() { animation.revert?.(); } }, clearSafety);
}

export function createStaggerReveal(containerEl, childEls, { reducedMotion = false, debug = false } = {}) {
  const children = (childEls || []).filter(Boolean);
  if (!containerEl || children.length === 0) return REVERT_NOOP;

  if (reducedMotion) {
    snapEnterFinalState(containerEl, children);
    return REVERT_NOOP;
  }

  children.forEach((child) => applyStyles(child, enterHiddenState()));

  const timeline = createTimeline({
    defaults: { ease: TIER1_DEFAULTS.ease },
    autoplay: onScroll(buildEnterScrollOptions(containerEl, { debug }))
  });

  timeline.add(
    children,
    {
      opacity: [0, 1],
      translateY: [TIER1_DEFAULTS.enterDistancePx, 0],
      duration: TIER1_DEFAULTS.enterDuration
    },
    stagger(TIER1_DEFAULTS.staggerMs)
  );

  return { revert() { timeline.revert?.(); } };
}

/** Tier 2: multi-property enter (opacity + translate + scale + optional rotate). */
export function createMultiPropertyEnter(
  el,
  {
    reducedMotion = false,
    autoplay = true,
    scrollTarget = null,
    debug = false,
    delay = 0,
    duration = TIER2_DEFAULTS.enterDuration,
    ease = TIER2_DEFAULTS.springEase,
    from = {},
    to = {}
  } = {}
) {
  if (!el) return REVERT_NOOP;

  const fromOpacity = from.opacity ?? 0;
  const fromY = from.translateY ?? TIER2_DEFAULTS.enterDistancePx;
  const fromX = from.translateX ?? 0;
  const fromScale = from.scale ?? 0.92;
  const fromRotate = from.rotate ?? 0;

  if (reducedMotion) {
    snapEnterFinalState(el);
    return REVERT_NOOP;
  }

  applyStyles(el, {
    opacity: String(fromOpacity),
    transform: `translate(${fromX}px, ${fromY}px) scale(${fromScale}) rotate(${fromRotate}deg)`
  });

  const scrollOpts = scrollTarget
    ? onScroll(buildEnterScrollOptions(scrollTarget, { debug }))
    : undefined;

  const animation = animate(el, {
    opacity: [fromOpacity, to.opacity ?? 1],
    translateY: [fromY, to.translateY ?? 0],
    translateX: [fromX, to.translateX ?? 0],
    scale: [fromScale, to.scale ?? 1],
    rotate: [fromRotate, to.rotate ?? 0],
    duration,
    delay,
    ease,
    autoplay: scrollOpts ?? autoplay
  });

  return { revert() { animation.revert?.(); } };
}

/** Tier 2: stagger children with scale + translateY + elastic settle. */
export function createElasticStaggerReveal(
  containerEl,
  childEls,
  {
    reducedMotion = false,
    debug = false,
    staggerDelays = null,
    fromScale = 0.88,
    distancePx = TIER2_DEFAULTS.enterDistancePx
  } = {}
) {
  const children = (childEls || []).filter(Boolean);
  if (!containerEl || children.length === 0) return REVERT_NOOP;

  if (reducedMotion) {
    snapEnterFinalState(containerEl, children);
    return REVERT_NOOP;
  }

  children.forEach((child) => applyStyles(child, enterHiddenStateScaled(distancePx, fromScale)));

  const timeline = createTimeline({
    defaults: { ease: TIER2_DEFAULTS.springEase },
    autoplay: onScroll(buildEnterScrollOptions(containerEl, { debug }))
  });

  children.forEach((child, index) => {
    const offset = staggerDelays?.[index] ?? index * TIER2_DEFAULTS.staggerMs;
    timeline.add(
      child,
      {
        opacity: [0, 1],
        translateY: [distancePx, 0],
        scale: [fromScale, 1],
        duration: TIER2_DEFAULTS.enterDuration
      },
      offset
    );
  });

  return { revert() { timeline.revert?.(); } };
}

/** Tier 2: word-by-word typing reveal — layout-stable (opacity only). */
export function createWordTypingReveal(
  wordEls,
  {
    reducedMotion = false,
    scrollTarget = null,
    debug = false,
    staggerMs = 52,
    duration = 240,
    delay = 0
  } = {}
) {
  const words = (wordEls || []).filter(Boolean);
  if (words.length === 0) return REVERT_NOOP;

  if (reducedMotion) {
    words.forEach((word) => applyStyles(word, { opacity: "1" }));
    return REVERT_NOOP;
  }

  words.forEach((word) => applyStyles(word, { opacity: "0" }));

  const target = scrollTarget || words[0];
  const timeline = createTimeline({
    defaults: { ease: "out(2)" },
    autoplay: onScroll(buildEnterScrollOptions(target, { debug }))
  });

  words.forEach((word, index) => {
    timeline.add(
      word,
      { opacity: [0, 1], duration },
      delay + index * staggerMs
    );
  });

  const clearSafety = scheduleRevealSafety(words[words.length - 1], {
    delay: delay + words.length * staggerMs,
    duration,
    extraMs: 600
  });

  return wrapRevealHandle({ revert() { timeline.revert?.(); } }, clearSafety);
}

/** Tier 2: reveal pre-wrapped headline line elements with non-uniform stagger. */
export function createSplitLineReveal(
  lineEls,
  {
    reducedMotion = false,
    scrollTarget = null,
    debug = false,
    distancePx = TIER2_DEFAULTS.enterDistancePx
  } = {}
) {
  const lines = (lineEls || []).filter(Boolean);
  if (lines.length === 0) return REVERT_NOOP;

  if (reducedMotion) {
    snapEnterFinalState(null, lines);
    return REVERT_NOOP;
  }

  lines.forEach((line) => applyStyles(line, enterHiddenState(distancePx)));

  const target = scrollTarget || lines[0];
  const timeline = createTimeline({
    defaults: { ease: TIER2_DEFAULTS.popEase },
    autoplay: onScroll(buildEnterScrollOptions(target, { debug }))
  });

  lines.forEach((line, index) => {
    timeline.add(
      line,
      {
        opacity: [0, 1],
        translateY: [distancePx, 0],
        duration: TIER2_DEFAULTS.enterDuration * 0.85
      },
      index * TIER2_DEFAULTS.lineStaggerMs
    );
  });

  return { revert() { timeline.revert?.(); } };
}

/** Tier 2: badge/pop accent element. */
export function createPopReveal(el, { reducedMotion = false, scrollTarget, debug = false, delay = 0 } = {}) {
  return createMultiPropertyEnter(el, {
    reducedMotion,
    scrollTarget: scrollTarget || el,
    debug,
    delay,
    duration: 520,
    ease: TIER2_DEFAULTS.popEase,
    from: { opacity: 0, translateY: 12, scale: 0.85 },
    to: { opacity: 1, translateY: 0, scale: 1 }
  });
}

/**
 * Tier 2: run a builder that returns timeline segments; single scroll observer on section.
 * @param {(tl: import('animejs').Timeline) => void} buildSteps
 */
export function createSetPieceTimeline(
  sectionEl,
  buildSteps,
  { reducedMotion = false, debug = false, children = [] } = {}
) {
  if (!sectionEl) return REVERT_NOOP;

  if (reducedMotion) {
    snapEnterFinalState(sectionEl, children);
    return REVERT_NOOP;
  }

  const timeline = createTimeline({
    defaults: { ease: TIER2_DEFAULTS.springEase },
    autoplay: onScroll(buildEnterScrollOptions(sectionEl, { debug }))
  });

  buildSteps(timeline);

  return { revert() { timeline.revert?.(); } };
}

/** Immediate (mount) timeline for above-fold hero — no scroll observer. */
export function createMountTimeline(buildSteps, { reducedMotion = false, children = [] } = {}) {
  if (reducedMotion) {
    children.filter(Boolean).forEach((el) => snapEnterFinalState(el));
    return REVERT_NOOP;
  }

  const timeline = createTimeline({
    defaults: { ease: TIER2_DEFAULTS.popEase },
    autoplay: true
  });

  buildSteps(timeline);

  return { revert() { timeline.revert?.(); } };
}

export function createScrollScrub(
  targetEl,
  sectionEl,
  { reducedMotion = false, debug = false, props } = {}
) {
  if (!targetEl || !sectionEl) return REVERT_NOOP;

  const tweens = props || {
    rotate: "1turn",
    scale: [0.6, 1.1],
    translateX: ["-40%", "40%"]
  };

  if (reducedMotion) {
    applyStyles(targetEl, enterFinalState());
    return REVERT_NOOP;
  }

  const animation = animate(targetEl, {
    ...tweens,
    ease: "linear",
    autoplay: onScroll(buildScrubScrollOptions(sectionEl, { debug }))
  });

  return { revert() { animation.revert?.(); } };
}

export function combineReverts(...handles) {
  return {
    revert() {
      revertAll(...handles);
    }
  };
}
