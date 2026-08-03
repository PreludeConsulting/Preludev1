/**
 * change-plan API auth + session credit mid-cycle reconcile.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBillingApiMiddleware } from "../../server/billingApi.js";
import {
  activateSessionPeriodFromPayment,
  getSessionCreditSummary,
  reconcileActiveSessionPeriodForPlanChange
} from "../../server/lib/sessionCredits.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERIOD_STORE = join(__dirname, "../../server/data/subscription-session-periods.json");

function mockReqRes({ method = "POST", pathname = "/api/billing/change-plan", body = null, headers = {} } = {}) {
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

test("change-plan requires auth and returns JSON 401", async () => {
  const middleware = createBillingApiMiddleware();
  const { req, res, body } = mockReqRes({
    body: { targetPlan: "PRO", stripeCustomerId: "cus_hostile", stripeSubscriptionId: "sub_hostile" }
  });
  await middleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(typeof body().error, "string");
  assert.notEqual(res.headers["Content-Type"]?.includes?.("text/html"), true);
});

test("mid-cycle Plus→Pro reconcile resets remaining to full Pro allowance", async () => {
  process.env.DATABASE_URL = "";
  process.env.NODE_ENV = "test";
  const dir = dirname(PERIOD_STORE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PERIOD_STORE, JSON.stringify({ periods: [], reservations: [] }, null, 2));

  const studentId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
  await activateSessionPeriodFromPayment({
    studentUserId: studentId,
    planId: "plus",
    periodStart: start,
    periodEnd: end,
    stripeSubscriptionId: "sub_test",
    idempotencyKey: `test-reconcile:${studentId}`
  });

  // Simulate 1 used session on Plus (allowance 2 → remaining 1).
  const { readFileSync } = await import("node:fs");
  const store = JSON.parse(readFileSync(PERIOD_STORE, "utf8"));
  const period = store.periods.find((row) => row.studentUserId === studentId);
  assert.ok(period);
  period.remaining = 1;
  writeFileSync(PERIOD_STORE, JSON.stringify(store, null, 2));

  const updated = await reconcileActiveSessionPeriodForPlanChange(studentId, "pro");
  assert.equal(updated.planId, "pro");
  assert.equal(updated.allowance, 4);
  // Upgrade resets to exactly 4 — does not preserve Plus usage.
  assert.equal(updated.remaining, 4);

  const summary = await getSessionCreditSummary(studentId);
  assert.equal(summary.allowance, 4);
  assert.equal(summary.remaining, 4);
  assert.equal(summary.used, 0);
});

test("Pro→Plus reconcile clamps remaining at zero when over allowance", async () => {
  process.env.DATABASE_URL = "";
  process.env.NODE_ENV = "test";
  const studentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  writeFileSync(PERIOD_STORE, JSON.stringify({ periods: [], reservations: [] }, null, 2));
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
  await activateSessionPeriodFromPayment({
    studentUserId: studentId,
    planId: "pro",
    periodStart: start,
    periodEnd: end,
    stripeSubscriptionId: "sub_test_2",
    idempotencyKey: `test-reconcile-down:${studentId}`
  });

  const { readFileSync } = await import("node:fs");
  const store = JSON.parse(readFileSync(PERIOD_STORE, "utf8"));
  const period = store.periods.find((row) => row.studentUserId === studentId);
  // 3 used on Pro → remaining 1; Plus allowance 2 → remaining max(0, 2-3)=0
  period.remaining = 1;
  writeFileSync(PERIOD_STORE, JSON.stringify(store, null, 2));

  const updated = await reconcileActiveSessionPeriodForPlanChange(studentId, "plus");
  assert.equal(updated.planId, "plus");
  assert.equal(updated.allowance, 2);
  assert.equal(updated.remaining, 0);
});
