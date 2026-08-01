import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { onRequest as chatOnRequest } from "../../functions/api/chat.js";
import { onRequest as checkoutOnRequest } from "../../functions/api/billing/checkout.js";
import { onRequest as rateLimitOnRequest } from "../../functions/_middleware.js";
import { resetCloudflareRateLimitBuckets } from "../../functions/_lib/apiRateLimit.js";

function request(url, { method = "POST", body = {} } = {}) {
  return new Request(`https://prelude.test${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "198.51.100.24"
    },
    body: JSON.stringify(body)
  });
}

function invoke(handler, context) {
  return rateLimitOnRequest({
    ...context,
    next: () => handler(context)
  });
}

describe("Cloudflare API rate limiting", () => {
  it("blocks chat before calling OpenAI", async () => {
    resetCloudflareRateLimitBuckets();
    const fetchMock = mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
      choices: [{ message: { content: "Hello." } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const env = {
      OPENAI_API_KEY: "sk-test",
      RATE_LIMIT_STORE: "memory"
    };

    for (let index = 0; index < 8; index += 1) {
      const context = { request: request("/api/chat", { body: { message: "hello" } }), env };
      const response = await invoke(chatOnRequest, context);
      assert.equal(response.status, 200);
    }
    const callsBeforeBlock = fetchMock.mock.callCount();

    const blocked = await invoke(chatOnRequest, { request: request("/api/chat", { body: { message: "hello" } }), env });
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error, "rate_limit_exceeded");
    assert.equal(fetchMock.mock.callCount(), callsBeforeBlock);

    fetchMock.mock.restore();
  });

  it("blocks checkout before calling Stripe", async () => {
    resetCloudflareRateLimitBuckets();
    const fetchMock = mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("/v1/prices/")) {
        return new Response(JSON.stringify({
          active: true,
          currency: "usd",
          unit_amount: 14999,
          type: "recurring",
          recurring: { interval: "month", interval_count: 1 },
          product: { metadata: { preludeOfferingId: "plus" } }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    const env = {
      BILLING_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_PRICE_ID_PLUS: "price_plus",
      STRIPE_PRICE_ID_PRO: "price_pro",
      STRIPE_PRICE_ID_ESSAY_SUPPORT_3: "price_essay3",
      STRIPE_PRICE_ID_ESSAY_SUPPORT_4: "price_essay4",
      STRIPE_PRICE_ID_ESSAY_SUPPORT_5: "price_essay5",
      STRIPE_PRICE_ID_ESSAY_SUPPORT_6: "price_essay6",
      STRIPE_PRICE_ID_ESSAY_SUPPORT_7: "price_essay7",
      STRIPE_PRICE_ID_ESSAY_SUPPORT_8: "price_essay8",
      STRIPE_PRICE_ID_ESSAY_SUPPORT_10: "price_essay10",
      STRIPE_ALLOW_GUEST_CHECKOUT: "true",
      RATE_LIMIT_STORE: "memory"
    };

    for (let index = 0; index < 5; index += 1) {
      const context = {
        request: request("/api/billing/checkout", { body: { planId: "plus", guestCheckout: true } }),
        env
      };
      const response = await invoke(checkoutOnRequest, context);
      assert.equal(response.status, 200);
    }
    const callsBeforeBlock = fetchMock.mock.callCount();

    const blocked = await invoke(checkoutOnRequest, {
      request: request("/api/billing/checkout", { body: { planId: "plus", guestCheckout: true } }),
      env
    });
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error, "rate_limit_exceeded");
    assert.equal(fetchMock.mock.callCount(), callsBeforeBlock);

    fetchMock.mock.restore();
  });
});
