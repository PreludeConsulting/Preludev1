/**
 * Stripe webhook signature + entitlement helpers.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSubscriptionEntitlement,
  deriveMembershipStatus
} from "../shared/billingMembership.js";
import { hasActiveMentorSubscription } from "../shared/mentorAccess.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(path) {
  return readFileSync(join(__dirname, "..", path), "utf8");
}

describe("Stripe webhook Cloudflare runtime", () => {
  it("exposes /api/stripe-webhook alias and verifies signatures from context.env", () => {
    const alias = read("functions/api/stripe-webhook.js");
    const webhook = read("functions/_lib/stripeBilling.js");
    expect(alias).toContain("handleBillingWebhook");
    expect(webhook).toContain("STRIPE_WEBHOOK_SECRET");
    expect(webhook).toContain("context.env");
    expect(webhook).toContain("claimBillingWebhookEvent");
    expect(webhook).toContain("missing_signature");
    expect(webhook).toContain("invalid_signature");
    expect(webhook).toMatch(/request\.text\(\)/);
    expect(webhook).toContain("JSON.parse(rawBody)");
  });

  it("does not hardcode webhook or secret key values", () => {
    const webhook = read("functions/_lib/stripeBilling.js");
    expect(webhook).not.toMatch(/whsec_[A-Za-z0-9]+/);
    expect(webhook).not.toMatch(/sk_live_[A-Za-z0-9]+/);
    expect(webhook).not.toMatch(/sk_test_[A-Za-z0-9]+/);
  });
});

describe("Membership entitlement states", () => {
  it("keeps access active through cancel_at_period_end", () => {
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const status = deriveMembershipStatus({
      planId: "pro",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: end
    });
    expect(status.accessActive).toBe(true);
    expect(status.key).toBe("cancels_at_period_end");
  });

  it("marks expired membership inactive", () => {
    const end = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "canceled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: end
    });
    expect(status.accessActive).toBe(false);
    expect(status.key).toBe("inactive");
    expect(status.label).toBe("Inactive");
  });

  it("builds authoritative /api/me/subscription DTO", () => {
    const end = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const dto = buildSubscriptionEntitlement({
      planId: "pro",
      pendingPlanId: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      billingPeriodEnd: end,
      entitlementEndsAt: end,
      sessionCreditsRemaining: 4,
      sessionCreditsTotal: 4
    });
    expect(dto.isActive).toBe(true);
    expect(dto.activePlan).toBe("PRO");
    expect(dto.pendingPlan).toBe("PLUS");
    expect(dto.downgradeScheduled).toBe(true);
    expect(dto.sessionCreditsRemaining).toBe(4);
  });

  it("preserves mentor access while canceled but still paid-through", () => {
    const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      hasActiveMentorSubscription({
        plan: "plus",
        subscriptionStatus: "canceled",
        entitlementEndsAt: end
      })
    ).toBe(true);
  });
});

describe("Billing UI contracts", () => {
  it("uses View other plans to return to the wallet", () => {
    const popup = read("src/components/BundleCustomizePopup.jsx");
    expect(popup).toContain("View other plans");
    expect(popup).not.toContain("View other options");
    expect(popup).toContain("onViewOtherBundles");
  });

  it("wires inactive membership guard and subscription provider", () => {
    const main = read("src/main.jsx");
    expect(main).toContain("RequireActiveMembershipGuard");
    expect(main).toContain("SubscriptionProvider");
    expect(read("functions/api/me/subscription.js")).toContain("handleMySubscription");
  });
});
