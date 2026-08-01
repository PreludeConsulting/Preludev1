/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "tok-123" } } })),
      refreshSession: vi.fn(async () => ({ data: { session: { access_token: "tok-456" } }, error: null }))
    }
  })
}));

describe("dashboard API client auth and JSON safety", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("attaches bearer tokens for meetings and integrations", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ meetings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/lib/dashboardApi.js");
    await api.getMeetings();
    await api.getIntegrations();
    expect(fetchMock).toHaveBeenCalled();
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe("Bearer tok-123");
    }
  });

  it("attaches bearer tokens for createMeeting and updateMeeting", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ meeting: { id: "m-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/lib/dashboardApi.js");
    await api.createMeeting({ title: "Check-in" }, { idempotencyKey: "abc-123" });
    await api.updateMeeting("m-1", { status: "scheduled" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe("Bearer tok-123");
    }
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("abc-123");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
  });

  it("rejects HTML success responses as deployment errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<!DOCTYPE html><html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        })
      )
    );
    const { api } = await import("../src/lib/auth.js");
    await expect(api("/api/meetings")).rejects.toThrow(/non-JSON|missing server handlers/i);
  });

  it("refreshes the Supabase session once on 401 for dashboard paths", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthenticated", message: "Authentication required." }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ meetings: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("../src/lib/auth.js");
    const payload = await api("/api/meetings", {
      headers: { Authorization: "Bearer expired" }
    });
    expect(payload).toEqual({ meetings: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer tok-456");
  });
});
