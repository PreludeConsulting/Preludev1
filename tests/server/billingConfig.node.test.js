import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBillingConfig, getPlanPriceId, isGuestCheckoutAllowed, STRIPE_API_VERSION } from "../../server/billingConfig.js";

describe("billing configuration", () => {
  it("keeps billing disabled unless Stripe is explicitly selected", () => {
    const config = getBillingConfig({});

    assert.equal(config.provider, "disabled");
    assert.equal(config.enabled, false);
    assert.deepEqual(config.missing, []);
  });

  it("reports missing Stripe values when Stripe billing is selected", () => {
    const config = getBillingConfig({ BILLING_PROVIDER: "stripe" });

    assert.equal(config.enabled, false);
    assert.deepEqual(config.missing, [
      "STRIPE_SECRET_KEY",
      "STRIPE_PRICE_ID_BASIC",
      "STRIPE_PRICE_ID_PLUS",
      "STRIPE_PRICE_ID_PRO"
    ]);
  });

  it("enables Stripe with supported key and price env names", () => {
    const config = getBillingConfig({
      BILLING_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "rk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      STRIPE_PUBLISHABLE_KEY: "pk_test_123",
      STRIPE_PRICE_ID_BASIC: "price_basic",
      STRIPE_PRICE_PLUS_MONTHLY: "price_plus",
      STRIPE_PRICE_ID_PRO: "price_pro"
    });

    assert.equal(config.enabled, true);
    assert.equal(config.webhookEnabled, true);
    assert.equal(config.stripePublishableKey, "pk_test_123");
    assert.equal(getPlanPriceId("basic", config), "price_basic");
    assert.equal(getPlanPriceId("plus", config), "price_plus");
    assert.equal(getPlanPriceId("pro", config), "price_pro");
    assert.equal(getPlanPriceId("unknown", config), null);
  });

  it("keeps webhook processing disabled until a signing secret is configured", () => {
    const config = getBillingConfig({
      BILLING_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "rk_test_123",
      STRIPE_PUBLISHABLE_KEY: "pk_test_123",
      STRIPE_PRICE_ID_BASIC: "price_basic",
      STRIPE_PRICE_ID_PLUS: "price_plus",
      STRIPE_PRICE_ID_PRO: "price_pro"
    });

    assert.equal(config.enabled, true);
    assert.equal(config.webhookEnabled, false);
    assert.deepEqual(config.missing, []);
  });

  it("allows guest checkout only for local development unless explicitly enabled", () => {
    assert.equal(isGuestCheckoutAllowed({ headers: { host: "localhost:5173" } }, { NODE_ENV: "development" }), true);
    assert.equal(isGuestCheckoutAllowed({ headers: { host: "preludeconsultingllc.com" } }, { NODE_ENV: "production" }), false);
    assert.equal(
      isGuestCheckoutAllowed(
        { headers: { host: "preludeconsultingllc.com" } },
        { NODE_ENV: "production", STRIPE_ALLOW_GUEST_CHECKOUT: "true" }
      ),
      true
    );
  });

  it("pins the Stripe API version used by the server client", () => {
    assert.equal(STRIPE_API_VERSION, "2026-05-27.dahlia");
  });
});
