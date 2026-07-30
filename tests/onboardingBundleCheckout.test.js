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
  startAuthenticatedBundleCheckout,
  startOnboardingBundleCheckout
} from "../src/lib/onboardingPayment.js";

describe("onboarding bundle checkout", () => {
  beforeEach(() => {
    mocks.api.mockReset();
    mocks.getSession.mockReset();
  });

  it("authenticates the checkout request with the current Supabase session", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } }
    });
    mocks.api.mockResolvedValue({ url: "https://checkout.example/session" });

    await startOnboardingBundleCheckout(
      { bundleId: "essay_support", quantities: { essayReviews: 3 } },
      { mentorId: "mentor-1" }
    );

    expect(mocks.api).toHaveBeenCalledWith(
      "/api/billing/bundle-checkout",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer access-token" }
      })
    );
    const body = JSON.parse(mocks.api.mock.calls[0][1].body);
    expect(body).toMatchObject({
      bundleId: "essay_support",
      context: "onboarding",
      mentorId: "mentor-1"
    });
  });

  it("reports an expired session before attempting checkout", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await expect(
      startOnboardingBundleCheckout({ bundleId: "essay_support" })
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("also authenticates checkout for an existing Supabase user outside onboarding", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "existing-user-token" } }
    });
    mocks.api.mockResolvedValue({ url: "https://checkout.example/session" });

    await startAuthenticatedBundleCheckout(
      { bundleId: "flexible_sessions" },
      { context: "public" }
    );

    expect(mocks.api.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer existing-user-token"
    });
    expect(JSON.parse(mocks.api.mock.calls[0][1].body).context).toBe("public");
  });
});
