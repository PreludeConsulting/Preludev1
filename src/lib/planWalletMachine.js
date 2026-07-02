/**
 * Plan wallet interaction state machine.
 *
 * Pure and framework-free so the interaction rules are unit-testable:
 * one popup at a time, no card selection while hidden, the wallet cannot
 * close while the popup is open, and rapid clicks cannot fork the state.
 */

export const WALLET_STATES = {
  CLOSED: "closed",
  OPENING: "opening",
  OPEN: "open",
  SELECTING_CARD: "selectingCard",
  POPUP_OPENING: "popupOpening",
  POPUP_OPEN: "popupOpen",
  POPUP_CLOSING: "popupClosing",
  CLOSING: "closing"
};

const S = WALLET_STATES;

export function createWalletState(initial = {}) {
  return {
    status: initial.status || S.CLOSED,
    selectedPlanId: initial.selectedPlanId || null,
    /** Plan whose popup is (or is becoming) visible. */
    popupPlanId: initial.popupPlanId || null
  };
}

/**
 * @param {ReturnType<typeof createWalletState>} state
 * @param {{ type: string, planId?: string }} event
 */
export function walletReducer(state, event) {
  switch (event.type) {
    case "PRESS_WALLET": {
      if (state.status === S.CLOSED) return { ...state, status: S.OPENING };
      // The wallet must not close while a popup exists in any form.
      if (state.status === S.OPEN || state.status === S.SELECTING_CARD) {
        return { ...state, status: S.CLOSING };
      }
      return state;
    }

    case "OPEN_SETTLED":
      return state.status === S.OPENING ? { ...state, status: S.OPEN } : state;

    case "CLOSE_SETTLED":
      return state.status === S.CLOSING ? { ...state, status: S.CLOSED } : state;

    case "SELECT_CARD": {
      if (!event.planId) return state;
      // Cards are selectable only while the deck is fully visible or while a
      // previous selection is still settling (latest valid selection wins).
      if (state.status !== S.OPEN && state.status !== S.SELECTING_CARD) return state;
      return { ...state, status: S.SELECTING_CARD, selectedPlanId: event.planId };
    }

    case "CARD_SETTLED": {
      if (state.status !== S.SELECTING_CARD) return state;
      return { ...state, status: S.POPUP_OPENING, popupPlanId: state.selectedPlanId };
    }

    case "POPUP_SETTLED":
      return state.status === S.POPUP_OPENING ? { ...state, status: S.POPUP_OPEN } : state;

    case "CLOSE_POPUP": {
      if (state.status !== S.POPUP_OPEN && state.status !== S.POPUP_OPENING) return state;
      return { ...state, status: S.POPUP_CLOSING };
    }

    case "POPUP_CLOSED": {
      if (state.status !== S.POPUP_CLOSING) return state;
      // Return to the already-open wallet; never replay the opening sequence.
      return { ...state, status: S.OPEN, popupPlanId: null };
    }

    case "RESTORE_OPEN":
      return { ...state, status: S.OPEN };

    default:
      return state;
  }
}

export function walletIsOpen(status) {
  return status !== S.CLOSED && status !== S.CLOSING && status !== S.OPENING;
}

export function walletShowsDeck(status) {
  return status !== S.CLOSED && status !== S.CLOSING;
}

export function cardsSelectable(status) {
  return status === S.OPEN || status === S.SELECTING_CARD;
}

export function popupVisible(status) {
  return status === S.POPUP_OPENING || status === S.POPUP_OPEN || status === S.POPUP_CLOSING;
}
