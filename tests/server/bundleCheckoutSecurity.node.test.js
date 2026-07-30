import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bundleCheckoutSchema } from "../../server/billingApi.js";
import { getBundlePriceId } from "../../server/billingConfig.js";
import {
  BUNDLE_QUANTITY_OPTIONS,
  essayPackageKey,
  quoteBundleSelection
} from "../../shared/supportBundles.js";

const config = {
  bundlePrices: {
    essay_support: {
      3: "price_serverEssay3",
      4: "price_serverEssay4",
      5: "price_serverEssay5",
      6: "price_serverEssay6",
      7: "price_serverEssay7",
      8: "price_serverEssay8",
      10: "price_serverEssay10"
    }
  }
};

const EXPECTED_CENTS = {
  3: 14900,
  4: 18900,
  5: 22900,
  6: 26500,
  7: 29900,
  8: 32900,
  10: 39900
};

describe("bundle checkout server controls", () => {
  it("accepts every approved Essay Support package and resolves price from server config", () => {
    for (const qty of BUNDLE_QUANTITY_OPTIONS) {
      const payload = bundleCheckoutSchema.parse({
        bundleId: "essay_support",
        quantities: { essayReviews: qty },
        context: "onboarding"
      });
      const quote = quoteBundleSelection(payload);

      assert.equal(quote.ok, true, `qty ${qty} should quote`);
      assert.equal(quote.totalCents, EXPECTED_CENTS[qty]);
      assert.equal(quote.purchaseType, "one_time_bundle");
      assert.equal(essayPackageKey(qty), `essay_support_${qty}`);
      assert.equal(
        getBundlePriceId(quote.selection.bundleId, quote.selection.quantities.essayReviews, config),
        `price_serverEssay${qty}`
      );
    }
  });

  it("rejects unknown, retired, or flexible-session bundle identifiers", () => {
    assert.equal(bundleCheckoutSchema.safeParse({ bundleId: "retired_bundle" }).success, false);
    assert.equal(bundleCheckoutSchema.safeParse({ bundleId: "pro" }).success, false);
    assert.equal(bundleCheckoutSchema.safeParse({ bundleId: "flexible_sessions" }).success, false);
    assert.equal(
      quoteBundleSelection({ bundleId: "flexible_sessions", quantities: { sessions: 3 } }).ok,
      false
    );
  });

  it("rejects client-provided prices and dollar amounts", () => {
    assert.equal(
      bundleCheckoutSchema.safeParse({
        bundleId: "essay_support",
        quantities: { essayReviews: 3 },
        priceId: "price_attacker",
        price: 1,
        amount: 1,
        totalCents: 1
      }).success,
      false
    );
  });

  it("rejects unsupported essay quantities like 9 instead of silently changing their price", () => {
    const payload = bundleCheckoutSchema.parse({
      bundleId: "essay_support",
      quantities: { essayReviews: 9 }
    });
    const quote = quoteBundleSelection(payload);

    assert.equal(quote.ok, false);
    assert.equal(quote.error, "validation_error");
    assert.equal(essayPackageKey(9), null);
  });
});
