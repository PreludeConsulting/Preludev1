import { createTimeline } from "animejs";

export const SAVINGS_TARGET_AMOUNT = 6500;
export const SAVINGS_COUNT_DURATION_MS = 1250;
export const COST_FAKE_CURSOR_HOTSPOT = { x: 4, y: 4 };
export const COST_FAKE_CURSOR_MS = {
  enter: 540,
  toAmount: 860,
  click: 260,
  exit: 420
};

export function easeOutCubic(progress) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export function savingsCountValue(elapsedMs, durationMs = SAVINGS_COUNT_DURATION_MS, target = SAVINGS_TARGET_AMOUNT) {
  if (durationMs <= 0) return target;
  return Math.round(target * easeOutCubic(elapsedMs / durationMs));
}

export function formatSavingsAmount(value) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function elementCenterPoint(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

export function pointInSection(sectionEl, xRatio, yRatio) {
  if (!sectionEl) return { x: 0, y: 0 };
  const rect = sectionEl.getBoundingClientRect();
  return {
    x: rect.width * xRatio - COST_FAKE_CURSOR_HOTSPOT.x,
    y: rect.height * yRatio - COST_FAKE_CURSOR_HOTSPOT.y
  };
}

export function elementPointInSection(sectionEl, element, xRatio = 0.5, yRatio = 0.5) {
  if (!sectionEl || !element) return pointInSection(sectionEl, xRatio, yRatio);
  const sectionRect = sectionEl.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width * xRatio - sectionRect.left - COST_FAKE_CURSOR_HOTSPOT.x,
    y: rect.top + rect.height * yRatio - sectionRect.top - COST_FAKE_CURSOR_HOTSPOT.y
  };
}

export function getCostFakeCursorPath(sectionEl, amountEl, headlineEl) {
  return {
    entry: pointInSection(sectionEl, -0.08, 0.58),
    amount: elementPointInSection(sectionEl, amountEl, 0.5, 0.5),
    headline: elementPointInSection(sectionEl, headlineEl, 0.58, 0.48),
    exit: elementPointInSection(sectionEl, amountEl, 0.5, 0.5)
  };
}

export function createCostBannerFakeCursorTimeline({
  sectionEl,
  cursorEl,
  amountEl,
  headlineEl,
  onReset,
  onActivate
} = {}) {
  if (!sectionEl || !cursorEl || !amountEl || !headlineEl) return null;

  const path = getCostFakeCursorPath(sectionEl, amountEl, headlineEl);
  cursorEl.style.transform = `translate3d(${path.entry.x}px, ${path.entry.y}px, 0)`;
  cursorEl.style.opacity = "0";

  const clearActiveState = () => {
    amountEl.classList.remove("admissions-cost-banner__amount--fake-active");
    headlineEl.classList.remove("admissions-cost-banner__headline--fake-active");
  };

  const timeline = createTimeline({
    autoplay: false,
    loop: false,
    defaults: { ease: "inOut(3)" }
  })
    .call(() => {
      clearActiveState();
      onReset?.();
    }, 0)
    .add(cursorEl, {
      translateX: [path.entry.x - 34, path.entry.x],
      translateY: [path.entry.y + 28, path.entry.y],
      opacity: [0, 1],
      scale: 1,
      duration: COST_FAKE_CURSOR_MS.enter
    })
    .add(cursorEl, {
      translateX: path.amount.x,
      translateY: path.amount.y,
      duration: COST_FAKE_CURSOR_MS.toAmount
    }, "+=140")
    .call(() => {
      amountEl.classList.add("admissions-cost-banner__amount--fake-active");
      onActivate?.();
    }, "+=80")
    .add(cursorEl, {
      scale: [1, 0.86, 1],
      duration: COST_FAKE_CURSOR_MS.click,
      ease: "out(3)"
    }, "<")
    .call(() => {
      amountEl.classList.remove("admissions-cost-banner__amount--fake-active");
      headlineEl.classList.add("admissions-cost-banner__headline--fake-active");
    }, "+=520")
    .add(cursorEl, {
      translateX: path.exit.x,
      translateY: path.exit.y,
      opacity: [1, 0],
      duration: COST_FAKE_CURSOR_MS.exit,
      ease: "out(2)"
    }, "+=120")
    .call(clearActiveState);

  return {
    play() {
      timeline.play();
    },
    cancel() {
      timeline.cancel();
      clearActiveState();
      cursorEl.style.opacity = "0";
    }
  };
}
