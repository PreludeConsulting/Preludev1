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

  it("maps every published bundle size to a dedicated one-time Price env var", () => {
    assert.deepEqual(Object.keys(BUNDLE_PRICE_ENV_BY_ID.essay_support), ["3", "4", "5", "6", "7", "8", "10"]);
    assert.deepEqual(Object.keys(BUNDLE_PRICE_ENV_BY_ID.flexible_sessions), ["3", "4", "5", "6", "7", "8", "10"]);
    assert.equal(REQUIRED_STRIPE_PRICE_ENV_KEYS.length, 17);

    const offerings = listStripeCatalogOfferings();
    assert.equal(offerings.filter((offering) => offering.kind === "subscription").length, 3);
    assert.equal(offerings.filter((offering) => offering.kind === "one_time").length, 2);
  });
});
