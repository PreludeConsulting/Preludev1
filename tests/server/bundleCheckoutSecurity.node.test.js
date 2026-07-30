import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bundleCheckoutSchema } from "../../server/billingApi.js";
import { getBundlePriceId } from "../../server/billingConfig.js";
import { quoteBundleSelection } from "../../shared/supportBundles.js";

const config = {
  bundlePrices: {
    essay_support: { 3: "price_serverEssay3" },
    flexible_sessions: { 4: "price_serverFlexible4" }
  }
};

describe("bundle checkout server controls", () => {
  it("accepts a recognized bundle and resolves price exclusively from server config", () => {
    const payload = bundleCheckoutSchema.parse({
      bundleId: "essay_support",
      quantities: { essayReviews: 3 },
      context: "onboarding"
    });
    const quote = quoteBundleSelection(payload);

    assert.equal(quote.ok, true);
    assert.equal(quote.totalCents, 14900);
    assert.equal(
      getBundlePriceId(quote.selection.bundleId, quote.selection.quantities.essayReviews, config),
      "price_serverEssay3"
    );
  });

  it("rejects unknown or retired bundle identifiers", () => {
    assert.equal(
      bundleCheckoutSchema.safeParse({ bundleId: "retired_bundle" }).success,
      false
    );
    assert.equal(
      bundleCheckoutSchema.safeParse({ bundleId: "pro" }).success,
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

  it("rejects unsupported quantities instead of silently changing their price", () => {
    const payload = bundleCheckoutSchema.parse({
      bundleId: "flexible_sessions",
      quantities: { sessions: 1 }
    });
    const quote = quoteBundleSelection(payload);

    assert.equal(quote.ok, false);
    assert.equal(quote.error, "validation_error");
  });
});
