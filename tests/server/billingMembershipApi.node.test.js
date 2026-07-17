/**
 * Billing membership API route wiring (auth required).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createBillingApiMiddleware } from "../../server/billingApi.js";

function mockReqRes({ method = "GET", pathname = "/api/billing/summary", body = null, headers = {} } = {}) {
  const chunks = [];
  const req = {
    method,
    url: pathname,
    headers: { "content-type": "application/json", ...headers },
    body: body == null ? undefined : JSON.stringify(body)
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

test("billing summary requires auth", async () => {
  const middleware = createBillingApiMiddleware();
  const { req, res, body } = mockReqRes({ pathname: "/api/billing/summary" });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.ok(body().error);
});

test("billing cancel requires auth", async () => {
  const middleware = createBillingApiMiddleware();
  const { req, res } = mockReqRes({ method: "POST", pathname: "/api/billing/cancel", body: {} });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
});

test("billing reactivate requires auth", async () => {
  const middleware = createBillingApiMiddleware();
  const { req, res } = mockReqRes({ method: "POST", pathname: "/api/billing/reactivate", body: {} });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
});

test("billing history requires auth", async () => {
  const middleware = createBillingApiMiddleware();
  const { req, res } = mockReqRes({ pathname: "/api/billing/history" });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
});
