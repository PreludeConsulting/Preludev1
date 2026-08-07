import { describe, expect, it } from "vitest";
import {
  CLEARED_PENDING_UPGRADE_METADATA,
  resolveSubscriptionPlanEntitlement
} from "../shared/billingSubscriptionSync.js";
import {
  buildStudentEntitlements,
  resolveBookingBlockReason
} from "../shared/studentEntitlements.js";

describe("resolveSubscriptionPlanEntitlement", () => {
  it("keeps Plus while an unpaid Plus→Pro upgrade is pending", () => {
    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "plus",
        mappedPlanId: "pro",
        paymentConfirmed: false,
        metadata: {
          pendingUpgrade: "true",
          previousPlanId: "plus",
          pendingPlanId: "pro",
          planId: "pro"
        }
      })
    ).toMatchObject({
      activePlanId: "plus",
      pendingPlanId: "pro",
      shouldClearPendingMetadata: false
    });
  });

  it("unlocks Pro after invoice payment and clears sticky pending flags", () => {
    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "plus",
        mappedPlanId: "pro",
        paymentConfirmed: true,
        metadata: {
          pendingUpgrade: "true",
          previousPlanId: "plus",
          pendingPlanId: "pro",
          planId: "pro"
        }
      })
    ).toMatchObject({
      activePlanId: "pro",
      pendingPlanId: null,
      shouldClearPendingMetadata: true
    });
  });

  it("does not demote confirmed Pro when sticky pendingUpgrade metadata remains", () => {
    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "pro",
        mappedPlanId: "pro",
        paymentConfirmed: false,
        metadata: {
          pendingUpgrade: "true",
          previousPlanId: "plus",
          pendingPlanId: "pro",
          planId: "pro"
        }
      })
    ).toMatchObject({
      activePlanId: "pro",
      pendingPlanId: null,
      shouldClearPendingMetadata: true
    });
  });

  it("unlocks Portal Plus→Pro immediately when Stripe maps to an active Pro price", () => {
    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "plus",
        mappedPlanId: "pro",
        paymentConfirmed: false,
        subscriptionStatus: "active",
        metadata: { planId: "pro" }
      })
    ).toMatchObject({
      activePlanId: "pro",
      pendingPlanId: null
    });
  });

  it("keeps Pro effective while Plus is scheduled through the paid period", () => {
    const periodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "pro",
        mappedPlanId: "plus",
        paymentConfirmed: false,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
        metadata: {
          pendingDowngrade: "true",
          previousPlanId: "pro",
          pendingPlanId: "plus",
          planId: "plus"
        }
      })
    ).toMatchObject({
      activePlanId: "pro",
      pendingPlanId: "plus",
      scheduledPlanId: "plus"
    });
  });

  it("applies Plus after the Pro paid period ends", () => {
    const periodEnd = new Date(Date.now() - 60_000).toISOString();
    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "pro",
        mappedPlanId: "plus",
        paymentConfirmed: true,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
        metadata: { planId: "plus", pendingDowngrade: "true", previousPlanId: "pro" }
      })
    ).toMatchObject({
      activePlanId: "plus",
      pendingPlanId: null,
      scheduledPlanId: null,
      shouldClearPendingMetadata: true
    });
  });

  it("exports empty Stripe metadata values for clearing pending upgrade flags", () => {
    expect(CLEARED_PENDING_UPGRADE_METADATA).toEqual({
      pendingUpgrade: "",
      pendingDowngrade: "",
      pendingPlanId: "",
      previousPlanId: ""
    });
  });
});

describe("buildStudentEntitlements", () => {
  it("keeps Essay Support credits independent of Pro membership", () => {
    const snapshot = buildStudentEntitlements({
      planId: "pro",
      subscriptionStatus: "active",
      billingPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
      sessionCredits: { active: true, allowance: 4, remaining: 4 },
      reviewCredits: { purchased: 3, assigned: 1, remaining: 2 }
    });
    expect(snapshot.effectiveMembership).toBe("pro");
    expect(snapshot.membershipAccessActive).toBe(true);
    expect(snapshot.sessionCreditsRemaining).toBe(4);
    expect(snapshot.essaySupportCreditsRemaining).toBe(2);
    expect(snapshot.hasEssaySupport).toBe(true);
  });

  it("exposes scheduled Pro→Plus without changing effective membership", () => {
    const ends = new Date(Date.now() + 86400000).toISOString();
    const snapshot = buildStudentEntitlements({
      planId: "pro",
      pendingPlanId: "plus",
      subscriptionStatus: "active",
      billingPeriodEnd: ends,
      entitlementEndsAt: ends,
      sessionCredits: { active: true, allowance: 4, remaining: 3 }
    });
    expect(snapshot.effectiveMembership).toBe("pro");
    expect(snapshot.scheduledMembership).toBe("plus");
    expect(snapshot.downgradeScheduled).toBe(true);
    expect(snapshot.scheduledChangeLabel).toMatch(/Plus/);
  });
});

describe("resolveBookingBlockReason", () => {
  it("separates no-subscription, zero-credits, and no-availability", () => {
    expect(resolveBookingBlockReason({ mentorAccess: null })).toBe("loading");
    expect(
      resolveBookingBlockReason({
        mentorAccess: { allowed: false, reason: "no_sessions", allowance: 0 }
      })
    ).toBe("no_subscription");
    expect(
      resolveBookingBlockReason({
        mentorAccess: {
          allowed: false,
          reason: "no_session_credits",
          allowance: 4,
          subscriptionRemaining: 0,
          packageRemaining: 0
        }
      })
    ).toBe("no_session_credits");
    expect(
      resolveBookingBlockReason({
        mentorAccess: { allowed: true, reason: null },
        mentorHasNoSlots: true
      })
    ).toBe("no_mentor_availability");
    expect(
      resolveBookingBlockReason({
        mentorAccess: { allowed: true, reason: null },
        mentorHasNoSlots: false
      })
    ).toBe("ok");
  });
});
