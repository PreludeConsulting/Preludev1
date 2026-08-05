import { describe, expect, it } from "vitest";
import {
  CLEARED_PENDING_UPGRADE_METADATA,
  resolveSubscriptionPlanEntitlement
} from "../shared/billingSubscriptionSync.js";

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
    ).toEqual({
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
    ).toEqual({
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
    ).toEqual({
      activePlanId: "pro",
      pendingPlanId: null,
      shouldClearPendingMetadata: true
    });
  });

  it("supports Portal upgrades without pending metadata once the invoice is paid", () => {
    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "plus",
        mappedPlanId: "pro",
        paymentConfirmed: false,
        metadata: { planId: "pro" }
      })
    ).toEqual({
      activePlanId: "plus",
      pendingPlanId: "pro",
      shouldClearPendingMetadata: false
    });

    expect(
      resolveSubscriptionPlanEntitlement({
        priorPlanId: "plus",
        mappedPlanId: "pro",
        paymentConfirmed: true,
        metadata: { planId: "pro" }
      })
    ).toEqual({
      activePlanId: "pro",
      pendingPlanId: null,
      shouldClearPendingMetadata: false
    });
  });

  it("exports empty Stripe metadata values for clearing pending upgrade flags", () => {
    expect(CLEARED_PENDING_UPGRADE_METADATA).toEqual({
      pendingUpgrade: "",
      pendingPlanId: "",
      previousPlanId: ""
    });
  });
});
