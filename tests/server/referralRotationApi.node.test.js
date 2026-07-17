/**
 * Referral rotation API auth + month validation (no Supabase required).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createReferralRotationApiMiddleware } from "../../server/referralRotationApi.js";
import { resolveRotationMonth, isFirstDayOfReferralMonth } from "../../server/lib/referralRotation.js";
import { referralMonthParts } from "../../shared/referralConstants.js";

function mockReqRes({ method = "POST", pathname = "/api/cron/rotate-referral-codes", body = {}, headers = {} } = {}) {
  const chunks = [];
  const req = {
    method,
    url: pathname,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(payload) {
      chunks.push(payload);
    }
  };
  return {
    req,
    res,
    body: () => (chunks[0] ? JSON.parse(chunks[0]) : null)
  };
}

test("rotation cron rejects missing CRON_SECRET config", async () => {
  const middleware = createReferralRotationApiMiddleware({});
  const { req, res, body } = mockReqRes({ headers: { authorization: "Bearer test-secret-value-1234" } });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 503);
  assert.equal(body().error, "cron_not_configured");
});

test("rotation cron rejects bad secret", async () => {
  const middleware = createReferralRotationApiMiddleware({
    CRON_SECRET: "a-very-long-cron-secret-value"
  });
  const { req, res, body } = mockReqRes({ headers: { authorization: "Bearer wrong-secret-value!!!!" } });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(body().error, "unauthorized");
});

test("resolveRotationMonth and first-day helper stay timezone-aware", () => {
  assert.equal(resolveRotationMonth("2026-12"), "2026-12-01");
  const parts = referralMonthParts(new Date("2026-03-01T05:00:00.000Z"));
  assert.equal(parts.validMonth, "2026-03");
  assert.equal(typeof isFirstDayOfReferralMonth(), "boolean");
});
