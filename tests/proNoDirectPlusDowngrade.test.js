/**
 * Pro cannot directly downgrade to Plus — cancel at period end, then buy Plus new.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLUS_BLOCKED_BY_PRO_MESSAGE,
  deriveMembershipStatus,
  hasActiveProEntitlement,
  membershipAccessExplanation,
  buildSubscriptionEntitlement
} from "../shared/billingMembership.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

describe("No direct Pro→Plus downgrades", () => {
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

  it("exposes the cancel-first Plus message", () => {
    expect(PLUS_BLOCKED_BY_PRO_MESSAGE).toContain("cancel your current Pro subscription first");
  });

  it("never marks downgradeScheduled for Pro→Plus", () => {
    const dto = buildSubscriptionEntitlement({
      planId: "pro",
      pendingPlanId: "plus",
      subscriptionStatus: "active",
      billingPeriodEnd: new Date(Date.now() + 86400000).toISOString()
    });
    expect(dto.downgradeScheduled).toBe(false);
  });

  it("wallet disables Plus purchase for active Pro and offers Manage subscription", () => {
    const source = read("src/components/PlanSelectionPage.jsx");
    expect(source).toContain("PLUS_BLOCKED_BY_PRO_MESSAGE");
    expect(source).toContain("isPlusBlockedByPro");
    expect(source).toContain("Manage subscription");
    expect(source).toContain("onManageSubscription");
    expect(source).toContain('activePaidPlanId === "plus" && plan.id === "pro"');
  });

  it("change-plan APIs reject Pro→Plus", () => {
    const node = read("server/lib/billingMembership.js");
    const cf = read("functions/_lib/billingMembershipApi.js");
    expect(node).toContain("downgrade_not_allowed");
    expect(cf).toContain("downgrade_not_allowed");
    expect(node).toContain("PLUS_BLOCKED_BY_PRO_MESSAGE");
    expect(cf).toContain("PLUS_BLOCKED_BY_PRO_MESSAGE");
    expect(node).not.toMatch(/deferDowngrade:\s*isDowngrade/);
    expect(cf).not.toMatch(/proration_behavior\",\s*isDowngrade/);
  });

  it("checkout APIs reject Plus while Pro entitlement is active", () => {
    const cf = read("functions/_lib/stripeBilling.js");
    const node = read("server/billingApi.js");
    expect(cf).toContain("hasActiveProEntitlement");
    expect(cf).toContain('planId === "plus"');
    expect(cf).toContain("downgrade_not_allowed");
    expect(node).toContain("hasActiveProEntitlement");
    expect(node).toContain('payload.planId === "plus"');
    expect(node).toContain("downgrade_not_allowed");
  });

  it("webhook sync no longer schedules Pro→Plus deferrals", () => {
    const cf = read("functions/_lib/stripeBilling.js");
    expect(cf).not.toContain("deferDowngrade");
    expect(cf).toContain("never schedule Pro→Plus downgrades");
    expect(cf).toContain("pendingUpgrade");
  });
});
