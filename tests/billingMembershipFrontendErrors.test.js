/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";

describe("billingMembership frontend error handling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps non-JSON SPA HTML responses to a safe billing message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<!DOCTYPE html><html><body>SPA</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        })
      )
    );
    vi.doMock("../src/lib/supabase.js", () => ({
      getSupabase: () => ({
        auth: {
          getSession: async () => ({ data: { session: { access_token: "tok" } } })
        }
      })
    }));

    const { fetchBillingSummary } = await import("../src/lib/billingMembership.js");
    await expect(fetchBillingSummary()).rejects.toMatchObject({
      message: "We couldn’t load your billing information. Please try again."
    });
  });

  it("retries after Try again by calling the summary endpoint again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<!DOCTYPE html><html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            eligible: true,
            plan: { id: "plus", name: "Plus" },
            membership: { key: "active" },
            sessions: { available: 0, packages: [] },
            reviewCredits: { purchased: 0, assigned: 0, remaining: 0 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("../src/lib/supabase.js", () => ({
      getSupabase: () => ({
        auth: {
          getSession: async () => ({ data: { session: { access_token: "tok" } } })
        }
      })
    }));

    const { fetchBillingSummary } = await import("../src/lib/billingMembership.js");
    await expect(fetchBillingSummary()).rejects.toThrow(/billing information/i);
    const ok = await fetchBillingSummary();
    expect(ok.plan.id).toBe("plus");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/billing/summary");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/billing/summary");
  });
});
