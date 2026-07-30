import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUNDLE_PRICE_ENV_BY_ID,
  listStripeCatalogOfferings,
  PLAN_PRICE_CENTS,
  REQUIRED_STRIPE_PRICE_ENV_KEYS
} from "../../shared/billingCatalog.js";

describe("Stripe billing catalog", () => {
  it("matches the published monthly plan prices", () => {
    assert.deepEqual(PLAN_PRICE_CENTS, {
      basic: 4999,
      plus: 14999,
      pro: 24999
    });
  });

  it("maps purchasable essay packages to dedicated one-time Price env vars", () => {
    assert.deepEqual(Object.keys(BUNDLE_PRICE_ENV_BY_ID.essay_support), ["3", "6", "10"]);
    assert.equal(BUNDLE_PRICE_ENV_BY_ID.flexible_sessions, undefined);
    // plus + pro + essay 3/6/10
    assert.equal(REQUIRED_STRIPE_PRICE_ENV_KEYS.length, 5);
    assert.ok(!REQUIRED_STRIPE_PRICE_ENV_KEYS.includes("STRIPE_PRICE_ID_BASIC"));

    const offerings = listStripeCatalogOfferings();
    // Legacy Basic remains listed for price lookup / existing subscribers.
    assert.equal(offerings.filter((offering) => offering.kind === "subscription").length, 3);
    assert.equal(offerings.filter((offering) => offering.kind === "one_time").length, 1);
    assert.equal(offerings.find((offering) => offering.id === "essay_support")?.kind, "one_time");
  });
});
