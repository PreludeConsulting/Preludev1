import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const couponSetup = fs.readFileSync("scripts/setup-stripe-referral.mjs", "utf8");
const domainSetup = fs.readFileSync("scripts/setup-stripe-domain.mjs", "utf8");

describe("Stripe referral setup", () => {
  it("creates the fixed one-time 20% referral coupon", () => {
    assert.match(couponSetup, /prelude_referral_20_once/);
    assert.match(couponSetup, /percent_off:\s*20/);
    assert.match(couponSetup, /duration:\s*"once"/);
    assert.match(couponSetup, /preludeReferral:\s*"true"/);
  });

  it("subscribes the Stripe endpoint to referral lifecycle events", () => {
    for (const eventType of [
      "invoice.paid",
      "charge.refunded",
      "charge.dispute.created",
      "invoice.voided"
    ]) {
      assert.match(domainSetup, new RegExp(eventType.replaceAll(".", "\\.")));
    }
  });

  it("keeps test and live Stripe setup keys isolated", () => {
    for (const source of [couponSetup, domainSetup]) {
      assert.match(source, /STRIPE_LIVE_SECRET_KEY/);
      assert.match(source, /STRIPE_TEST_SECRET_KEY/);
      assert.match(source, /Refusing to use a \$\{actualMode\}-mode key/);
    }
  });
});
