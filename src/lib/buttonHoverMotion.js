import { animate } from "animejs";

export const BUTTON_HOVER_MS = 320;
export const BUTTON_SHEEN_MS = 380;

const GLOW_IDLE = "0 0 0 rgb(120 106 255 / 0)";
const GLOW_ACTIVE =
  "0 10px 28px rgb(120 106 255 / 0.34), 0 0 0 1px rgb(255 255 255 / 0.14)";

export const BUTTON_HOVER_SELECTOR = [
  "[data-anime-hover=\"primary\"]",
  ".shopify-hero__cta",
  ".pm-btn--primary",
  ".pw-wallet__control",
  ".auth-submit"
].join(", ");

function ensureSheen(el) {
  let sheen = el.querySelector(".prelude-btn-sheen");
  if (sheen) return sheen;

  sheen = document.createElement("span");
  sheen.className = "prelude-btn-sheen";
  sheen.setAttribute("aria-hidden", "true");
  el.classList.add("prelude-btn-sheen-wrap");
  el.appendChild(sheen);
  return sheen;
}

/**
 * @param {HTMLElement | null} el
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {() => void}
 */
export function bindButtonHoverGlow(el, { reducedMotion = false } = {}) {
  if (!el || reducedMotion) return () => {};

  const sheen = ensureSheen(el);
  let glowMotion = null;
  let sheenMotion = null;
  let engaged = false;

  const stopMotions = () => {
    glowMotion?.pause();
    sheenMotion?.pause();
    glowMotion = null;
    sheenMotion = null;
  };

  const disengage = () => {
    if (!engaged) return;
    engaged = false;
    stopMotions();
    glowMotion = animate(el, {
      boxShadow: GLOW_IDLE,
      duration: BUTTON_HOVER_MS * 0.7,
      ease: "out(2)"
    });
    sheenMotion = animate(sheen, {
      opacity: 0,
      duration: 160,
      ease: "out(2)"
    });
  };

  const engage = () => {
    if (engaged) {
      stopMotions();
    } else {
      engaged = true;
    }

    glowMotion = animate(el, {
      boxShadow: GLOW_ACTIVE,
      duration: BUTTON_HOVER_MS,
      ease: "out(3)"
    });

    sheen.style.opacity = "0";
    sheenMotion = animate(sheen, {
      translateX: ["-120%", "120%"],
      opacity: [0, 0.88, 0],
      duration: BUTTON_SHEEN_MS,
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
    stopMotions();
    el.removeEventListener("mouseenter", onMouseEnter);
    el.removeEventListener("mouseleave", onMouseLeave);
    el.removeEventListener("focusin", onFocusIn);
    el.removeEventListener("focusout", onFocusOut);
    sheen.remove();
    el.classList.remove("prelude-btn-sheen-wrap");
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
