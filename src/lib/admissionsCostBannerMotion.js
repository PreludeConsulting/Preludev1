import { animate } from "animejs";

export const COST_CURSOR_MS = {
  enter: 620,
  toBadge: 980,
  click: 260,
  badgeHold: 420,
  toHeadline: 920,
  headlineHold: 720,
  exit: 480,
  loopPause: 520
};

export const COST_CURSOR_HOTSPOT = { x: 3, y: 3 };

/**
 * @param {HTMLElement} sectionEl
 * @param {HTMLElement} targetEl
 */
export function getTargetPoint(sectionEl, targetEl) {
  if (!sectionEl || !targetEl) return { x: 0, y: 0 };

  const sectionRect = sectionEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  return {
    x: targetRect.left + targetRect.width / 2 - sectionRect.left - COST_CURSOR_HOTSPOT.x,
    y: targetRect.top + targetRect.height / 2 - sectionRect.top - COST_CURSOR_HOTSPOT.y
  };
}

function delay(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function moveCursor(
  cursorEl,
  x,
  y,
  { duration, opacity = 1, scale = 1, ease = "inOut(3)", fromX, fromY, fadeIn = false } = {}
) {
  if (!cursorEl) return Promise.resolve(null);

  const startX = fromX ?? x;
  const startY = fromY ?? y;
  const opacityValue = Array.isArray(opacity) ? opacity : fadeIn ? [0, opacity] : opacity;

  return new Promise((resolve) => {
    animate(cursorEl, {
      translateX: [startX, x],
      translateY: [startY, y],
      opacity: opacityValue,
      scale,
      duration,
      ease,
      onComplete: resolve
    });
  });
}

function pulseClick(cursorEl, ringEl, x, y) {
  if (ringEl) {
    ringEl.style.left = `${x + COST_CURSOR_HOTSPOT.x}px`;
    ringEl.style.top = `${y + COST_CURSOR_HOTSPOT.y}px`;
    ringEl.classList.remove("admissions-cost-banner__click-ring--active");
    void ringEl.offsetWidth;
    ringEl.classList.add("admissions-cost-banner__click-ring--active");
  }

  if (!cursorEl) return Promise.resolve(null);

  return new Promise((resolve) => {
    animate(cursorEl, {
      scale: [1, 0.86, 1],
      duration: COST_CURSOR_MS.click,
      ease: "out(3)",
      onComplete: resolve
    });
  });
}

/**
 * Looped demo cursor: entry → badge click → headline hover → exit.
 */
export function runCostBannerCursorLoop({
  sectionEl,
  cursorEl,
  ringEl,
  targets,
  onBadgeActive,
  onHeadlineActive,
  reducedMotion = false
} = {}) {
  if (reducedMotion || !sectionEl || !cursorEl || !targets) {
    cursorEl?.classList.add("admissions-cost-banner__demo-cursor--hidden");
    onBadgeActive?.(false);
    onHeadlineActive?.(false);
    return { cancel() {} };
  }

  const abort = new AbortController();
  let running = false;

  const measure = () => ({
    entry: getTargetPoint(sectionEl, targets.entry),
    badge: getTargetPoint(sectionEl, targets.badge),
    headline: getTargetPoint(sectionEl, targets.headline)
  });

  const resetVisualState = () => {
    onBadgeActive?.(false);
    onHeadlineActive?.(false);
    ringEl?.classList.remove("admissions-cost-banner__click-ring--active");
  };

  async function cycle() {
    running = true;
    cursorEl.classList.remove("admissions-cost-banner__demo-cursor--hidden");

    while (!abort.signal.aborted) {
      resetVisualState();
      const points = measure();

      await moveCursor(cursorEl, points.entry.x, points.entry.y, {
        duration: COST_CURSOR_MS.enter,
        fromX: points.entry.x - 40,
        fromY: points.entry.y + 36,
        fadeIn: true
      });
      if (abort.signal.aborted) break;

      await moveCursor(cursorEl, points.badge.x, points.badge.y, {
        duration: COST_CURSOR_MS.toBadge,
        fromX: points.entry.x,
        fromY: points.entry.y
      });
      if (abort.signal.aborted) break;

      onBadgeActive?.(true);
      await pulseClick(cursorEl, ringEl, points.badge.x, points.badge.y);
      if (abort.signal.aborted) break;

      await delay(COST_CURSOR_MS.badgeHold, abort.signal);
      if (abort.signal.aborted) break;

      onBadgeActive?.(false);
      await moveCursor(cursorEl, points.headline.x, points.headline.y, {
        duration: COST_CURSOR_MS.toHeadline,
        fromX: points.badge.x,
        fromY: points.badge.y
      });
      if (abort.signal.aborted) break;

      onHeadlineActive?.(true);
      await delay(COST_CURSOR_MS.headlineHold, abort.signal);
      if (abort.signal.aborted) break;

      onHeadlineActive?.(false);
      await moveCursor(cursorEl, points.headline.x + 36, points.headline.y - 48, {
        duration: COST_CURSOR_MS.exit,
        opacity: [1, 0],
        ease: "in(2)"
      });
      if (abort.signal.aborted) break;

      await delay(COST_CURSOR_MS.loopPause, abort.signal);
    }

    running = false;
  }

  cycle();

  return {
    cancel() {
      abort.abort();
      resetVisualState();
      cursorEl.classList.add("admissions-cost-banner__demo-cursor--hidden");
    },
    isRunning() {
      return running;
    }
  };
}
