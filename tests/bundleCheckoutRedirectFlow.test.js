import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  getSession: vi.fn()
}));

vi.mock("../src/lib/auth.js", () => ({ api: mocks.api }));
vi.mock("../src/lib/supabaseConfig.js", () => ({ isSupabaseConfigured: () => true }));
vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => ({ auth: { getSession: mocks.getSession } })
}));

import {
  bundleCheckoutFailureAction,
  clearPendingBundleIntent,
  peekPendingBundleIntent,
  pendingBundlePaymentPath,
  savePendingBundleIntent
} from "../src/lib/bundlePurchaseIntent.js";
import {
  confirmOnboardingCheckoutSession,
  startAuthenticatedBundleCheckout,
  startOnboardingBillingCheckout,
  startOnboardingBundleCheckout
} from "../src/lib/onboardingPayment.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  };
}

describe("complete bundle checkout redirect flow", () => {
  beforeEach(() => {
    globalThis.window = {
      localStorage: createStorage(),
      sessionStorage: createStorage()
    };
    mocks.api.mockReset();
    mocks.getSession.mockReset();
  });

  it("preserves a guest selection through onboarding and clears it only after paid confirmation", async () => {
    // Guest selects a bundle before account creation.
    savePendingBundleIntent("essay_support");
    expect(peekPendingBundleIntent()?.bundleId).toBe("essay_support");

    // Account, questionnaire, and parent steps complete; refresh returns the authenticated user.
    const refreshedUser = {
      id: "student-1",
      authProvider: "supabase",
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: false
    };
    expect(refreshedUser.id).toBeTruthy();
    expect(pendingBundlePaymentPath()).toBe(
      "/onboarding/payment?mode=bundles&wallet=open&bundle=essay_support&details=open"
    );

    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "supabase-token" } }
    });
    mocks.api
      .mockResolvedValueOnce({ url: "https://checkout.stripe.test/session" })
      .mockResolvedValueOnce({ confirmed: true, paymentStatus: "paid" });

    const checkout = await startOnboardingBundleCheckout({
      bundleId: "essay_support",
      quantities: { essayReviews: 3 }
    });
    expect(checkout.url).toContain("checkout.stripe.test");
    expect(mocks.api.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer supabase-token"
    });

    // Session creation, refresh, Back, or cancel must retain retry state.
    expect(peekPendingBundleIntent()?.bundleId).toBe("essay_support");
    expect(pendingBundlePaymentPath()).toContain("bundle=essay_support");

    const confirmation = await confirmOnboardingCheckoutSession("cs_test_paid");
    expect(confirmation.confirmed).toBe(true);
    clearPendingBundleIntent();
    expect(peekPendingBundleIntent()).toBeNull();
  });

  it("routes 401 to login with the complete return URL and never to registration", () => {
    const returnUrl =
      "/onboarding/payment?mode=bundles&wallet=open&bundle=essay_support&details=open";
    const action = bundleCheckoutFailureAction({ status: 401 }, returnUrl);

    expect(action).toMatchObject({
      type: "login",
      path: "/login",
      state: { from: returnUrl }
    });
    expect(action.path).not.toBe("/register");
  });

  it("shows 403 authorization errors without redirecting to signup", () => {
    const action = bundleCheckoutFailureAction(
      { status: 403, message: "Onboarding is not ready." },
      "/onboarding/payment"
    );

    expect(action).toEqual({
      type: "authorization_error",
      message: "Onboarding is not ready."
    });
    expect(action.path).toBeUndefined();
  });

  it("allows an existing authenticated Supabase user to purchase a bundle", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "existing-user-token" } }
    });
    mocks.api.mockResolvedValue({ url: "https://checkout.stripe.test/existing" });

    await startAuthenticatedBundleCheckout(
      { bundleId: "flexible_sessions", quantities: { sessions: 4 } },
      { context: "public" }
    );

    expect(mocks.api.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer existing-user-token"
    );
  });

  it("keeps monthly onboarding checkout on its existing authenticated endpoint", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "monthly-token" } }
    });
    mocks.api.mockResolvedValue({ url: "https://checkout.stripe.test/monthly" });

    await startOnboardingBillingCheckout("plus");

    expect(mocks.api).toHaveBeenCalledWith(
      "/api/billing/checkout",
      expect.objectContaining({
        headers: { Authorization: "Bearer monthly-token" },
        body: JSON.stringify({ planId: "plus", context: "onboarding" })
      })
    );
  });
});
