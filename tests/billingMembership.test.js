/**
 * Billing membership status + access-end date rules (pure helpers).
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  canCancelMembership,
  canPurchaseMembership,
  canReactivateMembership,
  deriveMembershipStatus,
  formatMoneyCents,
  membershipAccessExplanation
} from "../shared/billingMembership.js";

describe("deriveMembershipStatus", () => {
  it("shows active with next renewal when auto-renew is on", () => {
    const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: periodEnd
    });
    assert.equal(status.key, "active");
    assert.equal(status.autoRenew, true);
    assert.equal(status.accessActive, true);
    assert.ok(status.renewsAt);
    assert.equal(status.endsAt, null);
  });

  it("keeps access until exact period end when cancel_at_period_end is set", () => {
    const periodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const status = deriveMembershipStatus({
      planId: "pro",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd
    });
    assert.equal(status.key, "cancels_at_period_end");
    assert.equal(status.autoRenew, false);
    assert.equal(status.accessActive, true);
    assert.equal(status.renewsAt, null);
    assert.equal(status.endsAt, periodEnd);
    assert.equal(canCancelMembership(status), false);
    assert.equal(canReactivateMembership(status), true);
  });

  it("marks expired after period end timestamp", () => {
    const periodEnd = new Date(Date.now() - 60 * 1000).toISOString();
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "canceled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd,
      now: new Date()
    });
    assert.equal(status.key, "expired");
    assert.equal(status.accessActive, false);
    assert.equal(canPurchaseMembership(status), true);
  });

  it("does not invent an early cutoff by subtracting a calendar day", () => {
    const periodEnd = new Date("2030-06-15T16:00:00.000Z");
    const justBefore = new Date(periodEnd.getTime() - 1000);
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd.toISOString(),
      now: justBefore
    });
    assert.equal(status.accessActive, true);
    assert.equal(status.endsAt, periodEnd.toISOString());
  });
});

describe("membershipAccessExplanation", () => {
  it("explains continued access through paid period", () => {
    const periodEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd
    });
    const text = membershipAccessExplanation(status);
    assert.match(text, /remains active until/i);
    assert.match(text, /not be charged again/i);
  });

  it("mentions remaining session credits when membership is inactive", () => {
    const status = deriveMembershipStatus({
      planId: "basic",
      subscriptionStatus: "canceled",
      currentPeriodEnd: new Date(Date.now() - 86400000).toISOString()
    });
    const text = membershipAccessExplanation(status, { sessionBalance: 3 });
    assert.match(text, /3 purchased session/i);
  });
});

describe("money formatting", () => {
  it("formats USD cents", () => {
    assert.equal(formatMoneyCents(14999, "usd"), "$149.99");
  });
});
