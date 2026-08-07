import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const profileEq = vi.fn(async () => ({ error: null }));
  const profileUpdate = vi.fn(() => ({ eq: profileEq }));
  const onboardingUpsert = vi.fn(async () => ({ error: null }));
  return {
    profileEq,
    profileUpdate,
    onboardingUpsert,
    recordPurchase: vi.fn(async () => {}),
    getSupabaseAdmin: vi.fn(() => ({
      from(table) {
        if (table === "profiles") return { update: mocks.profileUpdate };
        if (table === "onboarding_progress") return { upsert: mocks.onboardingUpsert };
        throw new Error(`unexpected table ${table}`);
      }
    }))
  };
});

vi.mock("../server/lib/supabaseRequestAuth.js", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin
}));

vi.mock("../server/lib/billingMembership.js", () => ({
  persistSubscriptionFields: vi.fn(),
  recordPurchaseFromCheckoutSession: mocks.recordPurchase
}));

import { syncSupabaseCheckoutSession } from "../server/lib/supabaseBillingSync.js";

describe("syncSupabaseCheckoutSession", () => {
  beforeEach(() => {
    mocks.profileEq.mockClear();
    mocks.profileUpdate.mockClear();
    mocks.onboardingUpsert.mockClear();
    mocks.recordPurchase.mockClear();
    mocks.getSupabaseAdmin.mockClear();
  });

  it("marks payment complete for paid monthly plan checkout", async () => {
    await syncSupabaseCheckoutSession({
      metadata: { userId: "student-1", planId: "plus" },
      customer: "cus_1",
      subscription: "sub_1",
      payment_status: "paid",
      status: "complete"
    });

    expect(mocks.profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "plus",
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        subscription_status: "active"
      })
    );
    expect(mocks.onboardingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "student-1",
        payment_step_completed: true,
        onboarding_status: "onboarding_completed"
      }),
      { onConflict: "user_id" }
    );
    expect(mocks.recordPurchase).toHaveBeenCalled();
  });

  it("marks payment complete for paid bundle checkout without a planId", async () => {
    await syncSupabaseCheckoutSession({
      metadata: { userId: "student-2", bundleId: "essay_support" },
      customer: "cus_2",
      payment_status: "paid",
      status: "complete"
    });

    expect(mocks.onboardingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "student-2",
        payment_step_completed: true,
        onboarding_status: "onboarding_completed"
      }),
      { onConflict: "user_id" }
    );
    // Bundle unlock must not invent a monthly plan or subscription status.
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      stripe_customer_id: "cus_2"
    });
    expect(mocks.recordPurchase).toHaveBeenCalled();
  });

  it("activates Plus from Payment Link even when amount_total is $0", async () => {
    await syncSupabaseCheckoutSession({
      client_reference_id: "student-zero",
      payment_link: "plink_1U07ivGRpwYd0PZQFhZs1ERC",
      customer: "cus_zero",
      subscription: "sub_zero",
      payment_status: "paid",
      amount_total: 0,
      mode: "subscription",
      status: "complete",
      metadata: {}
    });

    expect(mocks.profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: "plus",
        stripe_customer_id: "cus_zero",
        stripe_subscription_id: "sub_zero",
        subscription_status: "active"
      })
    );
    expect(mocks.onboardingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "student-zero",
        payment_step_completed: true
      }),
      { onConflict: "user_id" }
    );
  });

  it("does not unlock when checkout is unpaid", async () => {
    await syncSupabaseCheckoutSession({
      metadata: { userId: "student-3", bundleId: "essay_support" },
      payment_status: "unpaid"
    });

    expect(mocks.onboardingUpsert).not.toHaveBeenCalled();
    expect(mocks.recordPurchase).not.toHaveBeenCalled();
  });
});
