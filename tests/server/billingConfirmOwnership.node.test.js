import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBillingApiMiddleware } from "../../server/billingApi.js";

function request(body) {
  const payload = JSON.stringify(body);
  return {
    method: "POST",
    url: "/api/billing/confirm-session",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json"
    },
    on(event, callback) {
      if (event === "data") callback(payload);
      if (event === "end") callback();
      return this;
    }
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    end(value) {
      this.body = value ? JSON.parse(value) : null;
    }
  };
}

describe("billing checkout session ownership", () => {
  it("rejects checkout confirmation for a session owned by another user", async () => {
    const middleware = createBillingApiMiddleware({
      getBillingConfigFn: () => ({ enabled: true, stripeSecretKey: "sk_test_owned" }),
      requireSupabaseUserFn: async () => ({ user: { id: "user-1", email: "student@example.com" } }),
      getStripeClientFn: () => ({
        checkout: {
          sessions: {
            retrieve: async () => ({
              id: "cs_test_foreign",
              metadata: { userId: "user-2" },
              client_reference_id: "user-2",
              payment_status: "paid"
            })
          }
        }
      }),
      syncSupabaseCheckoutSessionFn: async () => assert.fail("foreign sessions must not be synced"),
      fulfillFlexibleSessionCheckoutFn: async () => assert.fail("foreign sessions must not be fulfilled"),
      fulfillEssaySupportCheckoutFn: async () => assert.fail("foreign sessions must not be fulfilled"),
      recordPurchaseFromCheckoutSessionFn: async () => assert.fail("foreign sessions must not be recorded")
    });
    const res = response();

    await middleware(request({ sessionId: "cs_test_foreign" }), res, () => assert.fail("billing route should be handled"));

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "forbidden");
  });
});
