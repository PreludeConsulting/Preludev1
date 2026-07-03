import { describe, expect, it } from "vitest";
import { WALLET_STATES } from "../src/lib/planWalletMachine.js";
import {
  backDispatchForStatus,
  resolveBackStep,
  shouldCloseWalletAfterPopup,
  shouldNavigateAfterClose
} from "../src/lib/planWalletBack.js";

const S = WALLET_STATES;

describe("planWalletBack", () => {
  it("resolves the next back step from wallet status", () => {
    expect(resolveBackStep(S.CLOSED)).toBe("navigate");
    expect(resolveBackStep(S.OPEN)).toBe("close_wallet");
    expect(resolveBackStep(S.POPUP_OPEN)).toBe("close_popup");
    expect(resolveBackStep(S.OPENING)).toBe("wait");
    expect(resolveBackStep(S.POPUP_CLOSING)).toBe("close_popup");
  });

  it("maps stable statuses to machine dispatches", () => {
    expect(backDispatchForStatus(S.POPUP_OPEN)).toEqual({ type: "CLOSE_POPUP" });
    expect(backDispatchForStatus(S.OPEN)).toEqual({ type: "PRESS_WALLET" });
    expect(backDispatchForStatus(S.OPENING)).toBeNull();
  });

  it("navigates only after the wallet fully closes", () => {
    expect(shouldNavigateAfterClose(S.CLOSED, true)).toBe(true);
    expect(shouldNavigateAfterClose(S.CLOSING, true)).toBe(false);
    expect(shouldNavigateAfterClose(S.CLOSED, false)).toBe(false);
  });

  it("collapses the open wallet after the popup closes when back is pending", () => {
    expect(shouldCloseWalletAfterPopup(S.OPEN, true)).toBe(true);
    expect(shouldCloseWalletAfterPopup(S.POPUP_OPEN, true)).toBe(false);
    expect(shouldCloseWalletAfterPopup(S.OPEN, false)).toBe(false);
  });
});
