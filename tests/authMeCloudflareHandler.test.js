import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAuthMe } from "../functions/api/auth/me.js";

function makeContext({ method = "GET", authorization = null, fetchImpl } = {}) {
  const headers = new Headers({ Accept: "application/json" });
  if (authorization) headers.set("Authorization", authorization);
  return {
    request: new Request("https://preludeconsultingllc.com/api/auth/me", { method, headers }),
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-test-key"
    },
    fetch: fetchImpl
  };
}

describe("/api/auth/me Cloudflare handler", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ships the Cloudflare route file", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    expect(fs.existsSync(path.join(process.cwd(), "functions/api/auth/me.js"))).toBe(true);
  });

  it("returns JSON 401 without a bearer token (never SPA HTML)", async () => {
    const response = await handleAuthMe(makeContext());
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    const body = await response.json();
    expect(body.error).toBe("unauthenticated");
    expect(body.message).toMatch(/authentication required/i);
    expect(JSON.stringify(body)).not.toMatch(/<!DOCTYPE|<html/i);
  });

  it("returns JSON user + csrfToken for a valid Supabase bearer", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const href = String(url);
      if (href.includes("/auth/v1/user")) {
        return new Response(
          JSON.stringify({
            id: "11111111-1111-1111-1111-111111111111",
            email: "student@example.com",
            email_confirmed_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
            user_metadata: { role: "student", full_name: "Ada Lovelace" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (href.includes("/rest/v1/profiles")) {
        return new Response(
          JSON.stringify([
            {
              id: "11111111-1111-1111-1111-111111111111",
              role: "student",
              full_name: "Ada Lovelace",
              email: "student@example.com",
              plan_id: "plus",
              subscription_status: "active",
              subscription_current_period_end: "2026-09-01T00:00:00Z",
              stripe_customer_id: "cus_test"
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } });
    });

    const response = await handleAuthMe(
      makeContext({ authorization: "Bearer user-token", fetchImpl })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    const setCookie = response.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/prelude_csrf=/);
    const body = await response.json();
    expect(body.csrfToken).toMatch(/^[a-f0-9]+$/i);
    expect(body.user).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      email: "student@example.com",
      role: "STUDENT",
      plan: "plus",
      emailVerified: true,
      hasBillingCustomer: true
    });
    expect(body.user).not.toHaveProperty("stripe_customer_id");
    expect(body).not.toHaveProperty("access_token");
    expect(body).not.toHaveProperty("refresh_token");
  });

  it("rejects non-GET methods with JSON", async () => {
    const response = await handleAuthMe(makeContext({ method: "POST" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
  });
});
