import { describe, expect, it } from "vitest";
import { WALLET_STATES } from "../src/lib/planWalletMachine.js";
import {
  CARD_LAYOUT,
  MOTION_MS,
  cardMotionValues,
  cardVariantForStatus,
  deckSheenOpacity,
  motionDuration,
  settleEventForStatus,
  walletHeightForStatus
} from "../src/lib/planWalletMotion.js";

const S = WALLET_STATES;
const PLAN_IDS = ["basic", "plus", "pro"];

describe("planWalletMotion helpers", () => {
  it("returns zero duration when reduced motion is enabled", () => {
    expect(motionDuration(MOTION_MS.open, true)).toBe(0);
    expect(motionDuration(MOTION_MS.popupEnter, true)).toBe(0);
    expect(motionDuration(MOTION_MS.open, false)).toBe(MOTION_MS.open);
  });

  it("computes deck offsets per card index", () => {
    expect(cardMotionValues(0, "deck")).toEqual({
      y: "0rem",
      scale: 1,
      opacity: 1
    });
    expect(cardMotionValues(1, "deck").y).toBe(`${CARD_LAYOUT.stepRem}rem`);
    expect(cardMotionValues(2, "popupSelected").scale).toBe(1.026);
  });

  it("hides cards while the wallet is closed or opening", () => {
    expect(cardVariantForStatus(S.CLOSED, "basic", 0, null, PLAN_IDS)).toBe("hidden");
    expect(cardVariantForStatus(S.OPENING, "pro", 2, "pro", PLAN_IDS)).toBe("hidden");
  });

  it("elevates the selected card during selection and popup phases", () => {
    expect(cardVariantForStatus(S.OPEN, "plus", 1, "plus", PLAN_IDS)).toBe("deckSelected");
    expect(cardVariantForStatus(S.SELECTING_CARD, "plus", 1, "plus", PLAN_IDS)).toBe(
      "selectingSelected"
    );
    expect(cardVariantForStatus(S.POPUP_OPEN, "plus", 1, "plus", PLAN_IDS)).toBe("popupSelected");
    expect(cardVariantForStatus(S.POPUP_OPEN, "basic", 0, "plus", PLAN_IDS)).toBe("popupSibling");
  });

  it("maps animating statuses to machine settle events", () => {
    expect(settleEventForStatus(S.OPENING)).toEqual({ type: "OPEN_SETTLED" });
    expect(settleEventForStatus(S.SELECTING_CARD)).toEqual({ type: "CARD_SETTLED" });
    expect(settleEventForStatus(S.POPUP_OPENING)).toEqual({ type: "POPUP_SETTLED" });
    expect(settleEventForStatus(S.POPUP_CLOSING)).toEqual({ type: "POPUP_CLOSED" });
    expect(settleEventForStatus(S.CLOSING)).toEqual({ type: "CLOSE_SETTLED" });
    expect(settleEventForStatus(S.OPEN)).toBeNull();
  });

  it("derives wallet height and sheen from status", () => {
    expect(walletHeightForStatus(S.CLOSED)).toBe("13.5rem");
    expect(walletHeightForStatus(S.OPEN)).toBe("29.5rem");
    expect(walletHeightForStatus(S.POPUP_OPENING)).toBe("29.5rem");
    expect(deckSheenOpacity(S.CLOSED)).toBe(1);
    expect(deckSheenOpacity(S.OPEN)).toBe(0);
    expect(deckSheenOpacity(S.CLOSING)).toBe(1);
  });
});
