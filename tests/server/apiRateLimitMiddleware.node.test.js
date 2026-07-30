import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createApiRateLimitMiddleware,
  createMemoryRateLimitStore
} from "../../server/lib/apiRateLimitMiddleware.js";

function mockReq(url, method = "GET") {
  return {
    method,
    url,
    headers: {
      "x-forwarded-for": "203.0.113.7",
      "user-agent": "node-test"
    },
    socket: { remoteAddress: "127.0.0.1" }
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload || "";
      this.writableEnded = true;
    }
  };
}

async function invoke(middleware, url, method = "GET") {
  const req = mockReq(url, method);
  const res = mockRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return {
    nextCalled,
    status: res.statusCode,
    headers: res.headers,
    json: res.body ? JSON.parse(res.body) : null
  };
}

describe("API rate limit middleware", () => {
  it("blocks chat before the downstream provider can be called", async () => {
    const middleware = createApiRateLimitMiddleware({
      store: createMemoryRateLimitStore(),
      now: () => 1_000
    });

    for (let index = 0; index < 8; index += 1) {
      const allowed = await invoke(middleware, "/api/chat", "POST");
      assert.equal(allowed.nextCalled, true);
    }

    const blocked = await invoke(middleware, "/api/chat", "POST");
    assert.equal(blocked.nextCalled, false);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.error, "rate_limit_exceeded");
    assert.equal(blocked.json.retryAfterSeconds, 59);
    assert.equal(blocked.headers["Retry-After"], "59");
    assert.equal(blocked.headers["X-RateLimit-Limit"], "8");
    assert.equal(blocked.headers["X-RateLimit-Remaining"], "0");
  });

  it("exempts options and signed system callback routes", async () => {
    const middleware = createApiRateLimitMiddleware({
      store: createMemoryRateLimitStore(),
      now: () => 1_000
    });

    for (let index = 0; index < 20; index += 1) {
      assert.equal((await invoke(middleware, "/api/chat", "OPTIONS")).nextCalled, true);
      assert.equal((await invoke(middleware, "/api/billing/webhook", "POST")).nextCalled, true);
      assert.equal((await invoke(middleware, "/api/cron/rotate-referral-codes", "POST")).nextCalled, true);
    }
  });

  it("fails closed for money routes when durable storage is unavailable", async () => {
    const middleware = createApiRateLimitMiddleware({
      store: {
        async increment() {
          throw new Error("database unavailable");
        }
      },
      now: () => 1_000
    });

    const blocked = await invoke(middleware, "/api/billing/checkout", "POST");
    assert.equal(blocked.nextCalled, false);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.error, "rate_limit_unavailable");
  });
});
