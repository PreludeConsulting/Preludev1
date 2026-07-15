import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const nodeBilling = fs.readFileSync("server/billingApi.js", "utf8");
const cloudflareBilling = fs.readFileSync("functions/_lib/stripeBilling.js", "utf8");

describe("Stripe checkout integration contract", () => {
  it("uses server-side Price IDs for both subscription and one-time checkout", () => {
    for (const source of [nodeBilling, cloudflareBilling]) {
      assert.match(source, /line_items(?:\[0\])?[^\n]*price/);
      assert.doesNotMatch(source, /price_data/);
      assert.doesNotMatch(source, /payment_method_types/);
      assert.match(source, /billing_price_mismatch/);
    }
  });

  it("recognizes every required subscription lifecycle webhook", () => {
    const requiredEvents = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed"
    ];
    for (const eventType of requiredEvents) {
      assert.match(nodeBilling, new RegExp(eventType.replaceAll(".", "\\.")));
      assert.match(cloudflareBilling, new RegExp(eventType.replaceAll(".", "\\.")));
    }
  });
});
