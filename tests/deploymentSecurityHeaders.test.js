import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));

describe("production response security headers", () => {
  const catchAll = config.headers?.find((entry) => entry.source === "/(.*)");
  const headers = Object.fromEntries((catchAll?.headers || []).map(({ key, value }) => [key.toLowerCase(), value]));

  it("applies browser hardening headers to every route", () => {
    expect(headers["strict-transport-security"]).toMatch(/max-age=\d+; includeSubDomains; preload/i);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toMatch(/camera=\(\)/);
  });

  it("ships a restrictive content security policy with required Prelude providers", () => {
    const csp = headers["content-security-policy"] || "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).not.toContain("script-src *");
  });
});
