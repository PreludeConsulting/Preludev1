#!/usr/bin/env node

import assert from "node:assert/strict";
import { createPromoApiMiddleware } from "../../server/promoApi.js";
import { resetIpRateLimitBuckets } from "../../server/lib/ipRateLimit.js";

function mockReq(url, method = "GET", body = null) {
  const payload = body ? JSON.stringify(body) : "";
  return {
    method,
    url,
    headers: {
      "content-type": "application/json",
      cookie: "",
      "user-agent": "node-test"
    },
    socket: { remoteAddress: "127.0.0.1" },
    on(event, cb) {
      if (event === "data" && payload) cb(payload);
      if (event === "end") cb();
      return this;
    }
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload ?? "";
    }
  };
  return res;
}

async function invoke(middleware, url, method = "GET", body = null) {
  const req = mockReq(url, method, body);
  const res = mockRes();
  await new Promise((resolve) => {
    middleware(req, res, resolve);
  });
  return {
    status: res.statusCode,
    json: res.body ? JSON.parse(res.body) : null
  };
}

async function main() {
  resetIpRateLimitBuckets();
  const middleware = createPromoApiMiddleware();

  const invalidFormat = await invoke(middleware, "/api/promo/validate", "POST", {
    code: "bad code!",
    email: "student@example.com"
  });
  assert.equal(invalidFormat.status, 200);
  assert.equal(invalidFormat.json.valid, false);
  assert.equal(invalidFormat.json.error, "invalid_code_format");

  const missingCode = await invoke(middleware, "/api/promo/validate", "POST", {
    code: "UNKNOWN-CODE-9999",
    email: "student@example.com"
  });
  assert.equal(missingCode.status, 200);
  assert.equal(missingCode.json.valid, false);
  assert.match(missingCode.json.message, /recognize|verify/i);

  const redeemUnauthenticated = await invoke(middleware, "/api/promo/redeem-at-signup", "POST", {
    code: "BASIC-FREE-7K2M",
    email: "student@example.com"
  });
  assert.equal(redeemUnauthenticated.status, 401);

  console.log("promo API node tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
