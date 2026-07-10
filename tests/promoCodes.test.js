import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  PROMO_CODE_PATTERN,
  normalizePromoCodeInput,
  promoPlanLabel,
  publicPromoError
} from "../shared/promoCodeConstants.js";
import {
  buildPromoSummary,
  hashPromoCode,
  isValidPromoCodeFormat
} from "../server/lib/promoCodes.js";

function isValidFormat(code) {
  return PROMO_CODE_PATTERN.test(code);
}

describe("promo code helpers", () => {
  it("normalizes codes case-insensitively and trims spaces", () => {
    assert.equal(normalizePromoCodeInput("  plus-free-9k4m "), "PLUS-FREE-9K4M");
  });

  it("accepts valid code formats only", () => {
    assert.equal(isValidPromoCodeFormat("PLUS-FREE-9K4M"), true);
    assert.equal(isValidFormat("PLUS-FREE-9K4M"), true);
    assert.equal(isValidPromoCodeFormat("bad code!"), false);
  });

  it("hashes codes deterministically", () => {
    const a = hashPromoCode("PLUS-FREE-9K4M");
    const b = hashPromoCode("plus-free-9k4m");
    assert.equal(a, b);
  });

  it("maps errors to user-safe messages", () => {
    assert.match(publicPromoError("expired"), /expired/i);
    assert.match(publicPromoError("not_found"), /recognize/i);
  });

  it("builds complimentary plan summaries", () => {
    const summary = buildPromoSummary({
      planId: "plus",
      permanentAccess: true,
      renewalBehavior: "requires_payment"
    });
    assert.equal(summary.plan, "Plus");
    assert.equal(summary.planId, "plus");
    assert.equal(summary.priceToday, "$0.00");
    assert.equal(summary.paymentMethodRequired, false);
    assert.equal(promoPlanLabel("plus"), "Plus");
  });
});
