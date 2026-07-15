import test from "node:test";
import assert from "node:assert/strict";
import { createReferralApiMiddleware } from "../../server/referralApi.js";

function mockReqRes({ method = "POST", pathname = "/api/referral/validate", body = {}, headers = {} } = {}) {
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

test("referral validate rejects missing code", async () => {
  const middleware = createReferralApiMiddleware({ RATE_LIMIT_SECRET: "test" });
  const { req, res, body } = mockReqRes({ body: { code: "" } });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(body().error, "validation_error");
});

test("referral code GET requires auth", async () => {
  const middleware = createReferralApiMiddleware({ RATE_LIMIT_SECRET: "test" });
  const { req, res, body } = mockReqRes({ method: "GET", pathname: "/api/referral/code", body: undefined });
  req.body = undefined;
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.ok(body().error);
});

test("referral claim requires auth", async () => {
  const middleware = createReferralApiMiddleware({ RATE_LIMIT_SECRET: "test" });
  const { req, res } = mockReqRes({
    method: "POST",
    pathname: "/api/referral/claim",
    body: { rewardId: "00000000-0000-4000-8000-000000000001" }
  });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
});
