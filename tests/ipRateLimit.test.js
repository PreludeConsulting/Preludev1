import { describe, expect, it, beforeEach } from "vitest";
import {
  checkIpRateLimit,
  enforceIpRateLimit,
  resetIpRateLimitBuckets
} from "../server/lib/ipRateLimit.js";

describe("ip rate limiting", () => {
  beforeEach(() => {
    resetIpRateLimitBuckets();
  });

  it("allows requests under the limit", () => {
    const route = "/api/auth/request-password-reset";
    const ip = "test-ip";
    expect(checkIpRateLimit({ route, ip, limit: 2, windowMs: 60_000, now: 1_000 }).allowed).toBe(true);
    expect(checkIpRateLimit({ route, ip, limit: 2, windowMs: 60_000, now: 2_000 }).allowed).toBe(true);
  });

  it("blocks requests over the limit within the window", () => {
    const route = "/api/auth/request-password-reset";
    const ip = "blocked-ip";
    checkIpRateLimit({ route, ip, limit: 2, windowMs: 60_000, now: 1_000 });
    checkIpRateLimit({ route, ip, limit: 2, windowMs: 60_000, now: 2_000 });
    const blocked = checkIpRateLimit({ route, ip, limit: 2, windowMs: 60_000, now: 3_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns a 429 error from enforceIpRateLimit", () => {
    const req = { headers: {}, socket: { remoteAddress: "127.0.0.1" } };
    const route = "/api/auth/request-password-reset";
    for (let index = 0; index < 5; index += 1) {
      expect(enforceIpRateLimit(req, route, 5, 3600)).toBeNull();
    }
    const blocked = enforceIpRateLimit(req, route, 5, 3600);
    expect(blocked?.statusCode).toBe(429);
    expect(blocked?.code).toBe("rate_limit_exceeded");
  });
});
