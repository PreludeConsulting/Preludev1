import { animate } from "animejs";

export const BUTTON_HOVER_MS = 320;

const GLOW_ACTIVE =
  "0 10px 28px rgb(120 106 255 / 0.34), 0 0 0 1px rgb(255 255 255 / 0.14)";

export const BUTTON_HOVER_SELECTOR = [
  "[data-anime-hover=\"primary\"]",
  ".pm-btn--primary",
  ".pw-wallet__control",
  ".auth-submit"
].join(", ");

function clearHoverStyles(el) {
  if (!el) return;
  el.style.boxShadow = "";
  el.classList.remove("prelude-btn-sheen-wrap");
  el.querySelector(".prelude-btn-sheen")?.remove();
}

/**
 * @param {HTMLElement | null} el
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {() => void}
 */
export function bindButtonHoverGlow(el, { reducedMotion = false } = {}) {
  if (!el || reducedMotion) return () => {};

  clearHoverStyles(el);

  let glowMotion = null;
  let engaged = false;

  const stopGlow = () => {
    glowMotion?.pause?.();
    glowMotion?.revert?.();
    glowMotion = null;
    clearHoverStyles(el);
  };

  const disengage = () => {
    if (!engaged) return;
    engaged = false;
    stopGlow();
  };

  const engage = () => {
    if (engaged) stopGlow();
    engaged = true;

    glowMotion = animate(el, {
      boxShadow: GLOW_ACTIVE,
      duration: BUTTON_HOVER_MS,
      ease: "out(3)"
    });
  };

  const containsRelated = (related) => related instanceof Node && el.contains(related);

  const onMouseEnter = () => engage();
  const onMouseLeave = (event) => {
    if (containsRelated(event.relatedTarget)) return;
    disengage();
  };
  const onFocusIn = () => engage();
  const onFocusOut = (event) => {
    if (containsRelated(event.relatedTarget)) return;
    disengage();
  };

  el.addEventListener("mouseenter", onMouseEnter);
  el.addEventListener("mouseleave", onMouseLeave);
  el.addEventListener("focusin", onFocusIn);
  el.addEventListener("focusout", onFocusOut);

  return () => {
    disengage();
    el.removeEventListener("mouseenter", onMouseEnter);
    el.removeEventListener("mouseleave", onMouseLeave);
    el.removeEventListener("focusin", onFocusIn);
    el.removeEventListener("focusout", onFocusOut);
    clearHoverStyles(el);
  };
}

/**
 * @param {ParentNode} [root]
 * @param {{ reducedMotion?: boolean }} [options]
 */
export function bindButtonHoverGlowAll(root = document, { reducedMotion = false } = {}) {
  if (reducedMotion || typeof document === "undefined") return () => {};

  const cleanups = Array.from(root.querySelectorAll(BUTTON_HOVER_SELECTOR))
    .filter((node) => node instanceof HTMLElement)
    .map((node) => bindButtonHoverGlow(node, { reducedMotion }));

  return () => cleanups.forEach((cleanup) => cleanup());
}
