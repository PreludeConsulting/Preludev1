import { WALLET_STATES, popupVisible } from "./planWalletMachine.js";

const S = WALLET_STATES;

/**
 * Next machine action when the user requests back navigation.
 * @param {string} status
 * @returns {"navigate"|"close_popup"|"close_wallet"|"wait"}
 */
export function resolveBackStep(status) {
  if (status === S.CLOSED) return "navigate";
  if (popupVisible(status)) return "close_popup";
  if (status === S.OPEN) return "close_wallet";
  return "wait";
}

/** @param {string} status @param {boolean} pendingBack */
export function shouldNavigateAfterClose(status, pendingBack) {
  return pendingBack && status === S.CLOSED;
}

/** @param {string} status @param {boolean} pendingBack */
export function shouldCloseWalletAfterPopup(status, pendingBack) {
  return pendingBack && status === S.OPEN;
}

/**
 * Immediate dispatch for back when status is stable enough to act.
 * @param {string} status
 * @returns {{ type: string } | null}
 */
export function backDispatchForStatus(status) {
  const step = resolveBackStep(status);
  if (step === "close_popup") return { type: "CLOSE_POPUP" };
  if (step === "close_wallet") return { type: "PRESS_WALLET" };
  return null;
}
