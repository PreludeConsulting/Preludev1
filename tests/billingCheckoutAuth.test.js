// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: null }));

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => mocks.client
}));

import { startBillingCheckout, startBundleCheckout } from "../src/lib/auth.js";

const originalFetch = globalThis.fetch;

describe("Stripe checkout authentication", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "signed-in-access-token" } }
        })
      }
    };
    const responseBody = JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_example" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: vi.fn().mockResolvedValue(responseBody),
      json: vi.fn().mockResolvedValue(JSON.parse(responseBody))
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends the Supabase bearer token when starting bundle checkout", async () => {
    await startBundleCheckout(
      {
        bundleId: "essay_support",
        quantities: { essayReviews: 5 },
        services: {
          personal_statement: true,
          supplemental_essays: true,
          revisions: true,
          final_edits: true
        }
      },
      { context: "onboarding" }
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/billing/bundle-checkout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer signed-in-access-token"
        })
      })
    );
  });

  it("sends the Supabase bearer token when starting plan checkout", async () => {
    await startBillingCheckout("plus", { context: "public" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/billing/checkout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer signed-in-access-token"
        })
      })
    );
  });
});
