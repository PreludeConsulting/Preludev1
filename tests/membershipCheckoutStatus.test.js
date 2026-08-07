import { describe, expect, it } from "vitest";
import { deriveMembershipStatus } from "../shared/billingMembership.js";
import { hasActiveMentorSubscription } from "../shared/mentorAccess.js";
import {
  isPaidMembershipStatus,
  normalizePersistedSubscriptionStatus
} from "../shared/stripeSubscriptionStatus.js";

describe("checkout session status must not mark Plus inactive", () => {
  it("normalizes Checkout Session status complete → active for persistence", () => {
    expect(normalizePersistedSubscriptionStatus("complete")).toBe("active");
    expect(normalizePersistedSubscriptionStatus("checkout_completed")).toBe("active");
    expect(normalizePersistedSubscriptionStatus("active")).toBe("active");
    expect(normalizePersistedSubscriptionStatus(null, { paymentSuccessful: true })).toBe("active");
    expect(isPaidMembershipStatus("complete")).toBe(true);
  });

  it("treats Plus + checkout complete as active membership (stuck-account heal)", () => {
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "complete",
      currentPeriodEnd: null
    });
    expect(status.accessActive).toBe(true);
    expect(status.key).toBe("active");
    expect(status.label).toBe("Active");
  });

  it("treats Essay Support → Plus with complete status as bookable", () => {
    expect(
      hasActiveMentorSubscription({
        plan: "plus",
        subscriptionStatus: "complete"
      })
    ).toBe(true);
  });

  it("keeps scheduled cancel_at_period_end Pro access", () => {
    const end = new Date(Date.now() + 86400000).toISOString();
    const status = deriveMembershipStatus({
      planId: "pro",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: end
    });
    expect(status.accessActive).toBe(true);
    expect(status.key).toBe("cancels_at_period_end");
  });

  it("does not revive truly canceled Plus after period end", () => {
    const end = new Date(Date.now() - 86400000).toISOString();
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "canceled",
      currentPeriodEnd: end
    });
    expect(status.accessActive).toBe(false);
    expect(status.key).toBe("inactive");
  });
});
