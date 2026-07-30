import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  EXEMPT_API_ROUTE_PATTERNS,
  RATE_LIMIT_TIERS,
  resolveApiRateLimitPolicy,
  routePatternFromApiFile
} from "../../server/lib/apiRateLimitPolicy.js";

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function routeFiles(dir) {
  return walk(dir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => path.relative(process.cwd(), file))
    .sort();
}

describe("API rate limit policy", () => {
  it("defines the balanced default tiers", () => {
    assert.deepEqual(RATE_LIMIT_TIERS.ai.windows, [
      { limit: 8, windowSeconds: 60 },
      { limit: 80, windowSeconds: 3600 }
    ]);
    assert.equal(RATE_LIMIT_TIERS.ai.failClosed, true);
    assert.deepEqual(RATE_LIMIT_TIERS.money.windows, [
      { limit: 5, windowSeconds: 60 },
      { limit: 30, windowSeconds: 3600 }
    ]);
    assert.equal(RATE_LIMIT_TIERS.money.failClosed, true);
    assert.deepEqual(RATE_LIMIT_TIERS.write.windows, [
      { limit: 30, windowSeconds: 60 },
      { limit: 300, windowSeconds: 3600 }
    ]);
    assert.deepEqual(RATE_LIMIT_TIERS.read_private.windows, [
      { limit: 240, windowSeconds: 60 },
      { limit: 2000, windowSeconds: 3600 }
    ]);
    assert.deepEqual(RATE_LIMIT_TIERS.read_public.windows, [
      { limit: 120, windowSeconds: 60 },
      { limit: 1000, windowSeconds: 3600 }
    ]);
    assert.deepEqual(RATE_LIMIT_TIERS.admin.windows, [{ limit: 60, windowSeconds: 60 }]);
  });

  it("resolves cost-sensitive and exempt routes", () => {
    assert.equal(resolveApiRateLimitPolicy("/api/chat", "POST").tier, "ai");
    assert.equal(resolveApiRateLimitPolicy("/api/billing/checkout", "POST").tier, "money");
    assert.equal(resolveApiRateLimitPolicy("/api/billing/bundle-checkout", "POST").tier, "money");
    assert.equal(resolveApiRateLimitPolicy("/api/billing/portal", "POST").tier, "money");
    assert.equal(resolveApiRateLimitPolicy("/api/referral/claim", "POST").tier, "money");
    assert.equal(resolveApiRateLimitPolicy("/api/auth/request-password-reset", "POST").tier, "auth_email");
    assert.equal(resolveApiRateLimitPolicy("/api/colleges/search", "GET").tier, "read_public");
    assert.equal(resolveApiRateLimitPolicy("/api/dashboard/app-data", "GET").tier, "read_private");
    assert.equal(resolveApiRateLimitPolicy("/api/dashboard/settings", "POST").tier, "write");
    assert.equal(resolveApiRateLimitPolicy("/api/admin/promo-codes", "POST").tier, "admin");
    assert.equal(resolveApiRateLimitPolicy("/api/billing/webhook", "POST").exempt, true);
    assert.equal(resolveApiRateLimitPolicy("/api/cron/rotate-referral-codes", "POST").exempt, true);
    assert.equal(resolveApiRateLimitPolicy("/api/chat", "OPTIONS").exempt, true);
  });

  it("covers every Vercel and Cloudflare API route file", () => {
    const files = [...routeFiles("api"), ...routeFiles("functions/api")];
    const uncovered = files
      .map((file) => ({ file, pattern: routePatternFromApiFile(file) }))
      .filter(({ pattern }) => {
        const policy = resolveApiRateLimitPolicy(pattern, "GET");
        return !policy || (!policy.tier && !policy.exempt);
      });

    assert.deepEqual(uncovered, []);
    assert.ok(EXEMPT_API_ROUTE_PATTERNS.includes("/api/billing/webhook"));
    assert.ok(EXEMPT_API_ROUTE_PATTERNS.includes("/api/cron/rotate-referral-codes"));
  });
});
