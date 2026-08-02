import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleBillingHistory,
  handleBillingSummary
} from "../functions/_lib/billingMembershipApi.js";
import { onRequest as unknownApiOnRequest } from "../functions/api/[[path]].js";
import { deriveMembershipStatus } from "../shared/billingMembership.js";

const root = process.cwd();

function makeContext({
  method = "GET",
  url = "https://preludeconsultingllc.com/api/billing/summary",
  authorization = null,
  env = {},
  fetchImpl
} = {}) {
  const headers = new Headers({ Accept: "application/json" });
  if (authorization) headers.set("Authorization", authorization);
  return {
    request: new Request(url, { method, headers }),
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
      BILLING_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_billing",
      PUBLIC_APP_URL: "https://preludeconsultingllc.com",
      ...env
    },
    fetch: fetchImpl
  };
}

function profileRow(overrides = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    role: "student",
    full_name: "Ada Lovelace",
    preferred_name: "Ada",
    plan_id: "plus",
    household_id: "hh-1",
    stripe_customer_id: "cus_test",
    stripe_subscription_id: "sub_test",
    subscription_status: "active",
    subscription_current_period_start: "2026-07-01T00:00:00.000Z",
    subscription_current_period_end: "2026-08-01T00:00:00.000Z",
    subscription_cancel_at_period_end: false,
    subscription_canceled_at: null,
    payment_waived: false,
    promo_access_ends_at: null,
    ...overrides
  };
}

function restRouter(routes) {
  return vi.fn(async (input, init = {}) => {
    const href = String(input);
    if (href.includes("/auth/v1/user")) {
      const auth = init.headers?.Authorization || "";
      if (!auth.includes("Bearer user-token")) {
        return new Response(JSON.stringify({ message: "invalid" }), { status: 401 });
      }
      return new Response(
        JSON.stringify({
          id: "11111111-1111-1111-1111-111111111111",
          email: "student@example.com",
          user_metadata: { role: "student" }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    for (const route of routes) {
      if (route.match(href, init)) {
        return route.respond(href, init);
      }
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
}

describe("Cloudflare billing summary/history handlers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    "functions/api/billing/summary.js",
    "functions/api/billing/history.js",
    "functions/api/billing/cancel.js",
    "functions/api/billing/reactivate.js",
    "functions/api/billing/portal.js",
    "functions/api/[[path]].js"
  ])("ships Cloudflare handler %s", (file) => {
    expect(fs.existsSync(path.join(root, file))).toBe(true);
  });

  it("returns JSON 401 for unauthenticated billing summary", async () => {
    const response = await handleBillingSummary(makeContext());
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    expect(JSON.stringify(body)).not.toMatch(/<!DOCTYPE|<html/i);
  });

  it("returns active Plus subscription summary for authenticated user", async () => {
    const fetchImpl = restRouter([
      {
        match: (href) => href.includes("/rest/v1/profiles?id=eq."),
        respond: () =>
          new Response(JSON.stringify([profileRow({ plan_id: "plus" })]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
      },
      {
        match: (href) => href.includes("/rest/v1/household_members"),
        respond: () =>
          new Response(
            JSON.stringify([{ user_id: "11111111-1111-1111-1111-111111111111", role: "student" }]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      }
    ]);
    vi.stubGlobal("fetch", fetchImpl);

    const response = await handleBillingSummary(
      makeContext({ authorization: "Bearer user-token", fetchImpl })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    const body = await response.json();
    expect(body.eligible).toBe(true);
    expect(body.plan.id).toBe("plus");
    expect(body.plan.name).toBe("Plus");
    expect(body.subscription.status).toBe("active");
    expect(body.subscription.stripeCustomerId).toBe("cus_test");
    expect(body.subscription.stripeSubscriptionId).toBe("sub_test");
    expect(body.canOpenCustomerPortal).toBe(true);
    expect(body.membership.key).toBe("active");
  });

  it("returns active Pro subscription summary", async () => {
    const fetchImpl = restRouter([
      {
        match: (href) => href.includes("/rest/v1/profiles?id=eq."),
        respond: () =>
          new Response(JSON.stringify([profileRow({ plan_id: "pro" })]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
      },
      {
        match: (href) => href.includes("/rest/v1/household_members"),
        respond: () =>
          new Response(
            JSON.stringify([{ user_id: "11111111-1111-1111-1111-111111111111", role: "student" }]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      }
    ]);
    vi.stubGlobal("fetch", fetchImpl);
    const response = await handleBillingSummary(
      makeContext({ authorization: "Bearer user-token", fetchImpl })
    );
    const body = await response.json();
    expect(body.plan.id).toBe("pro");
    expect(body.membership.accessActive).toBe(true);
  });

  it("keeps Plus access for 100%-off forever coupon style active subscription", async () => {
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-09-01T00:00:00.000Z"
    });
    expect(status.key).toBe("active");
    expect(status.accessActive).toBe(true);
  });

  it("keeps Plus access for one-time 20%-off coupon style active subscription", async () => {
    const status = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-09-01T00:00:00.000Z"
    });
    expect(status.autoRenew).toBe(true);
  });

  it("returns essay support review credits", async () => {
    const fetchImpl = restRouter([
      {
        match: (href) => href.includes("/rest/v1/profiles?id=eq."),
        respond: () =>
          new Response(
            JSON.stringify([
              profileRow({
                plan_id: "basic",
                stripe_subscription_id: null,
                subscription_status: null,
                stripe_customer_id: "cus_essay"
              })
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      },
      {
        match: (href) => href.includes("/rest/v1/household_members"),
        respond: () =>
          new Response(
            JSON.stringify([{ user_id: "11111111-1111-1111-1111-111111111111", role: "student" }]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      },
      {
        match: (href) => href.includes("/rest/v1/review_credit_ledger"),
        respond: () =>
          new Response(
            JSON.stringify([
              {
                amount: 5,
                transaction_type: "PURCHASE",
                student_user_id: "11111111-1111-1111-1111-111111111111"
              },
              {
                amount: -1,
                transaction_type: "ACTIVITY_ASSIGNED",
                student_user_id: "11111111-1111-1111-1111-111111111111"
              }
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      },
      {
        match: (href) => href.includes("bundle_id=eq.essay_support"),
        respond: () =>
          new Response(
            JSON.stringify([
              {
                id: "pkg-1",
                student_user_id: "11111111-1111-1111-1111-111111111111",
                bundle_id: "essay_support",
                sessions_purchased: 5,
                sessions_remaining: 4,
                status: "active"
              }
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      }
    ]);
    vi.stubGlobal("fetch", fetchImpl);
    const response = await handleBillingSummary(
      makeContext({ authorization: "Bearer user-token", fetchImpl })
    );
    const body = await response.json();
    expect(body.essaySupport.remainingCredits).toBe(4);
    expect(body.essaySupport.totalPurchasedCredits).toBeGreaterThanOrEqual(4);
    expect(body.reviewCredits.remaining).toBe(4);
  });

  it("returns no-plan user with empty purchase history", async () => {
    const fetchImpl = restRouter([
      {
        match: (href) => href.includes("/rest/v1/profiles?id=eq."),
        respond: () =>
          new Response(
            JSON.stringify([
              profileRow({
                plan_id: "basic",
                stripe_customer_id: null,
                stripe_subscription_id: null,
                subscription_status: null,
                subscription_current_period_start: null,
                subscription_current_period_end: null
              })
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      },
      {
        match: (href) => href.includes("/rest/v1/household_members"),
        respond: () =>
          new Response(
            JSON.stringify([{ user_id: "11111111-1111-1111-1111-111111111111", role: "student" }]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      },
      {
        match: (href) => href.includes("/rest/v1/billing_purchases"),
        respond: () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
      }
    ]);
    vi.stubGlobal("fetch", fetchImpl);
    const summary = await handleBillingSummary(
      makeContext({ authorization: "Bearer user-token", fetchImpl })
    );
    const history = await handleBillingHistory(
      makeContext({
        authorization: "Bearer user-token",
        url: "https://preludeconsultingllc.com/api/billing/history?limit=10&offset=0",
        fetchImpl
      })
    );
    const summaryBody = await summary.json();
    const historyBody = await history.json();
    expect(summaryBody.canOpenCustomerPortal).toBe(false);
    expect(summaryBody.subscription.stripeCustomerId).toBeNull();
    expect(historyBody.purchases).toEqual([]);
  });

  it("marks cancel-at-period-end and past-due correctly", async () => {
    const canceling = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-09-01T00:00:00.000Z"
    });
    expect(canceling.key).toBe("cancels_at_period_end");

    const pastDue = deriveMembershipStatus({
      planId: "plus",
      subscriptionStatus: "past_due",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-09-01T00:00:00.000Z"
    });
    expect(pastDue.key).toBe("past_due");
  });

  it("unknown API route returns JSON 404 (never index.html)", async () => {
    const response = await unknownApiOnRequest({
      request: new Request("https://preludeconsultingllc.com/api/does-not-exist", {
        method: "GET"
      })
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    const body = await response.json();
    expect(body.error).toBe("API route not found");
    expect(JSON.stringify(body)).not.toMatch(/<!DOCTYPE|<html/i);
  });
});
