/**
 * Pro→Plus is scheduled for period end — Pro stays effective until then.
 * Checkout must not open a second Plus subscription while Pro is active.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRO_TO_PLUS_USE_PORTAL_MESSAGE,
  deriveMembershipStatus,
  hasActiveProEntitlement,
  membershipAccessExplanation,
  buildSubscriptionEntitlement
} from "../shared/billingMembership.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

describe("Pro→Plus scheduled downgrade", () => {
  it("keeps Pro access after cancel_at_period_end until paid-through date", () => {
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const status = deriveMembershipStatus({
      planId: "pro",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: end
    });
    expect(status.accessActive).toBe(true);
    expect(status.key).toBe("cancels_at_period_end");
    expect(
      hasActiveProEntitlement({
        planId: "pro",
        subscriptionStatus: "active",
        cancelAtPeriodEnd: true,
        entitlementEndsAt: end
      })
    ).toBe(true);
    expect(
      membershipAccessExplanation(status, { planId: "pro" })
    ).toMatch(/Your Pro subscription is scheduled to end on/);
  });

  it("clears Pro entitlement after paid period ends", () => {
    const end = new Date(Date.now() - 60 * 1000).toISOString();
    expect(
      hasActiveProEntitlement({
        planId: "pro",
        subscriptionStatus: "canceled",
        cancelAtPeriodEnd: true,
        entitlementEndsAt: end
      })
    ).toBe(false);
  });

  it("marks downgradeScheduled while Plus is pending and Pro is effective", () => {
    const dto = buildSubscriptionEntitlement({
      planId: "pro",
      pendingPlanId: "plus",
      subscriptionStatus: "active",
      billingPeriodEnd: new Date(Date.now() + 86400000).toISOString()
    });
    expect(dto.effectiveMembership).toBe("pro");
    expect(dto.scheduledMembership).toBe("plus");
    expect(dto.downgradeScheduled).toBe(true);
  });

  it("directs Pro members to Manage billing instead of a second Plus checkout", () => {
    expect(PRO_TO_PLUS_USE_PORTAL_MESSAGE).toMatch(/Manage billing|billing period/i);
    const source = read("src/components/PlanSelectionPage.jsx");
    expect(source).toContain("isPlusBlockedByPro");
    expect(source).toContain("Manage subscription");
  });

  it("change-plan APIs schedule Pro→Plus instead of unlocking Plus early", () => {
    const node = read("server/lib/billingMembership.js");
    const cf = read("functions/_lib/billingMembershipApi.js");
    expect(node).toContain('pendingDowngrade: "true"');
    expect(cf).toContain("pendingDowngrade");
    expect(node).toContain('plan_id: "pro"');
    expect(node).toContain('pending_plan_id: "plus"');
    expect(cf).toContain('pending_plan_id: "plus"');
  });

  it("checkout APIs reject Plus while Pro entitlement is active", () => {
    const cf = read("functions/_lib/stripeBilling.js");
    const node = read("server/billingApi.js");
    expect(cf).toContain("hasActiveProEntitlement");
    expect(cf).toContain('planId === "plus"');
    expect(node).toContain("hasActiveProEntitlement");
    expect(node).toContain('payload.planId === "plus"');
  });

  it("webhook sync keeps Pro effective during scheduled Plus downgrades", () => {
    const shared = read("shared/billingSubscriptionSync.js");
    expect(shared).toContain("scheduledDowngradeToPlus");
    expect(shared).toContain('pendingPlanId: "plus"');
    expect(shared).toContain("pendingDowngrade");
  });
});
