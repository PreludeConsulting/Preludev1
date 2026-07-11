const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function getTabbable(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true"
  );
}

export function trapFocus(root, event) {
  if (event.key !== "Tab") return false;
  const focusable = getTabbable(root);
  if (!focusable.length) {
    event.preventDefault();
    root?.focus?.({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function setBackgroundInert(enabled) {
  const root = document.getElementById("root");
  if (!root) return () => {};
  if (enabled) {
    root.setAttribute("inert", "");
    root.setAttribute("aria-hidden", "true");
  } else {
    root.removeAttribute("inert");
    root.removeAttribute("aria-hidden");
  }
  return () => setBackgroundInert(false);
}

export function lockBodyScroll(enabled) {
  const previous = document.body.style.overflow;
  document.body.style.overflow = enabled ? "hidden" : previous || "";
  return () => {
    document.body.style.overflow = previous;
  };
}

/**
 * @param {HTMLElement | null} container
 * @param {{ onEscape?: () => void, returnFocusRef?: { current: HTMLElement | null } }} options
 */
export function bindFocusTrap(container, { onEscape, returnFocusRef } = {}) {
  if (!container) return () => {};

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const openedFromKeyboard = Boolean(previousFocus?.matches?.(":focus-visible"));
  const releaseInert = setBackgroundInert(true);
  const releaseScroll = lockBodyScroll(true);

  const frame = window.requestAnimationFrame(() => {
    const focusTarget = openedFromKeyboard ? getTabbable(container)[0] : container;
    focusTarget?.focus?.({ preventScroll: true });
  });

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape?.();
      return;
    }
    trapFocus(container, event);
  }

  document.addEventListener("keydown", onKeyDown);

  return () => {
    window.cancelAnimationFrame(frame);
    document.removeEventListener("keydown", onKeyDown);
    releaseInert();
    releaseScroll();
    const returnTarget = returnFocusRef?.current || previousFocus;
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
  };
}
