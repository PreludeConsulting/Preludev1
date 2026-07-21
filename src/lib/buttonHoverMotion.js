export const BUTTON_HOVER_MS = 320;

export const BUTTON_HOVER_SELECTOR = [
  "[data-anime-hover=\"primary\"]",
  ".shopify-hero__cta",
  ".pm-btn--primary",
  ".pw-wallet__control",
  ".auth-submit"
].join(", ");

/**
 * @param {HTMLElement | null} el
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {() => void}
 */
export function bindButtonHoverGlow(el, { reducedMotion = false } = {}) {
  if (!el || reducedMotion) return () => {};
  el.classList.add("prelude-btn-hover-ready");

  return () => {
    el.classList.remove("prelude-btn-hover-ready");
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
