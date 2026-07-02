import { describe, expect, it } from "vitest";
import {
  WALLET_STATES,
  cardsSelectable,
  createWalletState,
  popupVisible,
  walletReducer,
  walletShowsDeck
} from "../src/lib/planWalletMachine.js";

const S = WALLET_STATES;

function run(state, ...events) {
  return events.reduce((acc, event) => walletReducer(acc, event), state);
}

describe("plan wallet state machine", () => {
  it("opens from closed and settles once", () => {
    let state = createWalletState();
    state = walletReducer(state, { type: "PRESS_WALLET" });
    expect(state.status).toBe(S.OPENING);
    state = walletReducer(state, { type: "OPEN_SETTLED" });
    expect(state.status).toBe(S.OPEN);
    // A stray settle event cannot re-trigger anything.
    expect(walletReducer(state, { type: "OPEN_SETTLED" }).status).toBe(S.OPEN);
  });

  it("ignores wallet presses while opening (rapid clicks)", () => {
    let state = createWalletState({ status: S.OPENING });
    state = walletReducer(state, { type: "PRESS_WALLET" });
    expect(state.status).toBe(S.OPENING);
  });

  it("does not allow card selection while the deck is hidden", () => {
    const closed = createWalletState();
    expect(walletReducer(closed, { type: "SELECT_CARD", planId: "pro" })).toEqual(closed);
    const opening = createWalletState({ status: S.OPENING });
    expect(walletReducer(opening, { type: "SELECT_CARD", planId: "pro" }).status).toBe(S.OPENING);
  });

  it("selects a card and opens exactly one popup after the motion settles", () => {
    let state = createWalletState({ status: S.OPEN });
    state = walletReducer(state, { type: "SELECT_CARD", planId: "plus" });
    expect(state.status).toBe(S.SELECTING_CARD);
    expect(state.selectedPlanId).toBe("plus");
    expect(state.popupPlanId).toBeNull();

    state = walletReducer(state, { type: "CARD_SETTLED" });
    expect(state.status).toBe(S.POPUP_OPENING);
    expect(state.popupPlanId).toBe("plus");

    state = walletReducer(state, { type: "POPUP_SETTLED" });
    expect(state.status).toBe(S.POPUP_OPEN);
  });

  it("lets the most recent rapid card selection win", () => {
    let state = createWalletState({ status: S.OPEN });
    state = run(
      state,
      { type: "SELECT_CARD", planId: "basic" },
      { type: "SELECT_CARD", planId: "plus" },
      { type: "SELECT_CARD", planId: "pro" }
    );
    expect(state.status).toBe(S.SELECTING_CARD);
    expect(state.selectedPlanId).toBe("pro");
    state = walletReducer(state, { type: "CARD_SETTLED" });
    expect(state.popupPlanId).toBe("pro");
  });

  it("cannot open a second popup while one exists", () => {
    const state = createWalletState({
      status: S.POPUP_OPEN,
      selectedPlanId: "pro",
      popupPlanId: "pro"
    });
    expect(walletReducer(state, { type: "SELECT_CARD", planId: "basic" })).toEqual(state);
  });

  it("cannot close the wallet while the popup is open or animating", () => {
    for (const status of [S.POPUP_OPENING, S.POPUP_OPEN, S.POPUP_CLOSING]) {
      const state = createWalletState({ status, selectedPlanId: "plus", popupPlanId: "plus" });
      expect(walletReducer(state, { type: "PRESS_WALLET" }).status).toBe(status);
    }
  });

  it("returns to the open wallet with selection intact after View other plans", () => {
    let state = createWalletState({
      status: S.POPUP_OPEN,
      selectedPlanId: "plus",
      popupPlanId: "plus"
    });
    state = walletReducer(state, { type: "CLOSE_POPUP" });
    expect(state.status).toBe(S.POPUP_CLOSING);
    state = walletReducer(state, { type: "POPUP_CLOSED" });
    expect(state.status).toBe(S.OPEN);
    expect(state.selectedPlanId).toBe("plus");
    expect(state.popupPlanId).toBeNull();
  });

  it("ignores duplicate close-popup requests", () => {
    let state = createWalletState({ status: S.POPUP_CLOSING, selectedPlanId: "pro", popupPlanId: "pro" });
    expect(walletReducer(state, { type: "CLOSE_POPUP" }).status).toBe(S.POPUP_CLOSING);
    state = walletReducer(state, { type: "POPUP_CLOSED" });
    expect(walletReducer(state, { type: "POPUP_CLOSED" })).toEqual(state);
  });

  it("closes the wallet only from stable open states", () => {
    let state = createWalletState({ status: S.OPEN });
    state = walletReducer(state, { type: "PRESS_WALLET" });
    expect(state.status).toBe(S.CLOSING);
    state = walletReducer(state, { type: "CLOSE_SETTLED" });
    expect(state.status).toBe(S.CLOSED);
  });

  it("exposes correct derived visibility helpers", () => {
    expect(walletShowsDeck(S.CLOSED)).toBe(false);
    expect(walletShowsDeck(S.CLOSING)).toBe(false);
    expect(walletShowsDeck(S.OPEN)).toBe(true);
    expect(walletShowsDeck(S.POPUP_OPEN)).toBe(true);

    expect(cardsSelectable(S.OPEN)).toBe(true);
    expect(cardsSelectable(S.SELECTING_CARD)).toBe(true);
    expect(cardsSelectable(S.OPENING)).toBe(false);
    expect(cardsSelectable(S.POPUP_OPEN)).toBe(false);

    expect(popupVisible(S.POPUP_OPENING)).toBe(true);
    expect(popupVisible(S.POPUP_OPEN)).toBe(true);
    expect(popupVisible(S.POPUP_CLOSING)).toBe(true);
    expect(popupVisible(S.OPEN)).toBe(false);
  });
});
