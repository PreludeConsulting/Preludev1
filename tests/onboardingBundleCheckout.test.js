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
  ESSAY_SUPPORT_OPTIONS,
  SUBSCRIPTION_PAYMENT_LINKS
} from "../shared/stripePaymentLinks.js";
import {
  startAuthenticatedBundleCheckout,
  startOnboardingBillingCheckout,
  startOnboardingBundleCheckout
} from "../src/lib/onboardingPayment.js";

const AUTH_USER = { id: "user-abc", email: "student@example.com" };

describe("onboarding Payment Link checkout", () => {
  beforeEach(() => {
    mocks.api.mockReset();
    mocks.getSession.mockReset();
  });

  it("builds Plus Payment Link with client_reference_id and locked_prefilled_email", () => {
    const result = startOnboardingBillingCheckout("plus", AUTH_USER);
    const url = new URL(result.url);
    expect(result.paymentLinkId).toBe(SUBSCRIPTION_PAYMENT_LINKS.plus.paymentLinkId);
    expect(url.origin + url.pathname).toBe(SUBSCRIPTION_PAYMENT_LINKS.plus.url);
    expect(url.searchParams.get("client_reference_id")).toBe(AUTH_USER.id);
    expect(url.searchParams.get("locked_prefilled_email")).toBe(AUTH_USER.email);
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("builds Pro Payment Link only for Pro", () => {
    const result = startOnboardingBillingCheckout("pro", AUTH_USER);
    expect(result.paymentLinkId).toBe(SUBSCRIPTION_PAYMENT_LINKS.pro.paymentLinkId);
    expect(result.url).toContain(SUBSCRIPTION_PAYMENT_LINKS.pro.url.replace("https://", ""));
  });

  it("builds essay Payment Link for every allowed quantity", () => {
    for (const credits of [3, 4, 5, 6, 7, 8, 10]) {
      const result = startOnboardingBundleCheckout(
        { bundleId: "essay_support", quantities: { essayReviews: credits } },
        AUTH_USER
      );
      const expected = ESSAY_SUPPORT_OPTIONS[credits];
      const url = new URL(result.url);
      expect(result.paymentLinkId).toBe(expected.paymentLinkId);
      expect(url.origin + url.pathname).toBe(expected.url);
      expect(url.searchParams.get("client_reference_id")).toBe(AUTH_USER.id);
      expect(url.searchParams.get("locked_prefilled_email")).toBe(AUTH_USER.email);
      expect(result.credits).toBe(credits);
    }
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("rejects missing user identity without calling Stripe APIs", () => {
    expect(() => startOnboardingBillingCheckout("plus", { id: "x" })).toThrow(
      /missing required checkout details/i
    );
    expect(() =>
      startOnboardingBundleCheckout(
        { bundleId: "essay_support", quantities: { essayReviews: 3 } },
        { email: "a@b.com" }
      )
    ).toThrow(/missing required checkout details/i);
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("rejects invalid essay quantities including 9", () => {
    expect(() =>
      startOnboardingBundleCheckout(
        { bundleId: "essay_support", quantities: { essayReviews: 9 } },
        AUTH_USER
      )
    ).toThrow(/valid Essay Support package/i);
  });

  it("keeps authenticated non-onboarding bundle checkout on the API", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "existing-user-token" } }
    });
    mocks.api.mockResolvedValue({ url: "https://checkout.example/session" });

    await startAuthenticatedBundleCheckout(
      { bundleId: "essay_support", quantities: { essayReviews: 3 } },
      { context: "public" }
    );

    expect(mocks.api).toHaveBeenCalledWith(
      "/api/billing/bundle-checkout",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer existing-user-token" }
      })
    );
  });
});
