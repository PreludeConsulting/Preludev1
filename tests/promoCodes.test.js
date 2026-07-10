import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  PROMO_CODE_PATTERN,
  normalizePromoCodeInput,
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
    assert.equal(normalizePromoCodeInput("  basic-free-7k2m "), "BASIC-FREE-7K2M");
  });

  it("accepts valid code formats only", () => {
    assert.equal(isValidPromoCodeFormat("BASIC-FREE-7K2M"), true);
    assert.equal(isValidFormat("BASIC-FREE-7K2M"), true);
    assert.equal(isValidPromoCodeFormat("bad code!"), false);
  });

  it("hashes codes deterministically", () => {
    const a = hashPromoCode("BASIC-FREE-7K2M");
    const b = hashPromoCode("basic-free-7k2m");
    assert.equal(a, b);
  });

  it("maps errors to user-safe messages", () => {
    assert.match(publicPromoError("expired"), /expired/i);
    assert.match(publicPromoError("not_found"), /recognize/i);
  });

  it("builds complimentary basic summaries", () => {
    const summary = buildPromoSummary({
      planId: "basic",
      permanentAccess: true,
      renewalBehavior: "requires_payment"
    });
    assert.equal(summary.plan, "Basic");
    assert.equal(summary.priceToday, "$0.00");
    assert.equal(summary.paymentMethodRequired, false);
  });
});
