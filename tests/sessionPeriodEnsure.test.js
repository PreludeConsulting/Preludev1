import { describe, expect, it } from "vitest";
import {
  resolvePaidMembershipPeriodBounds,
  sessionPeriodEnsureIdempotencyKey,
  shouldInitializeSessionPeriodForSubscription
} from "../shared/sessionPeriodEnsure.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("sessionPeriodEnsure — first billing period", () => {
  it("recognizes Stripe active Plus/Pro period bounds as period #1", () => {
    const start = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      shouldInitializeSessionPeriodForSubscription({
        subscriptionStatus: "active",
        planId: "plus",
        periodStartIso: start,
        periodEndIso: end
      })
    ).toBe(true);
    expect(
      shouldInitializeSessionPeriodForSubscription({
        subscriptionStatus: "incomplete",
        planId: "plus",
        periodStartIso: start,
        periodEndIso: end
      })
    ).toBe(false);
    expect(
      shouldInitializeSessionPeriodForSubscription({
        subscriptionStatus: "active",
        planId: "basic",
        periodStartIso: start,
        periodEndIso: end
      })
    ).toBe(false);
  });

  it("resolves Basil item periods and latest_invoice line fallback", () => {
    const startUnix = 1_700_000_000;
    const endUnix = 1_700_268_000;
    expect(
      resolvePaidMembershipPeriodBounds({
        items: { data: [{ current_period_start: startUnix, current_period_end: endUnix }] }
      })
    ).toEqual({
      startUnix,
      endUnix,
      startIso: new Date(startUnix * 1000).toISOString(),
      endIso: new Date(endUnix * 1000).toISOString()
    });

    expect(
      resolvePaidMembershipPeriodBounds({
        latest_invoice: {
          lines: { data: [{ period: { start: startUnix, end: endUnix } }] }
        }
      })
    ).toEqual({
      startUnix,
      endUnix,
      startIso: new Date(startUnix * 1000).toISOString(),
      endIso: new Date(endUnix * 1000).toISOString()
    });
  });

  it("uses subscriptionId + periodStart for idempotency", () => {
    expect(
      sessionPeriodEnsureIdempotencyKey({
        studentUserId: "u1",
        periodStartIso: "2026-08-01T00:00:00.000Z",
        periodEndIso: "2026-09-01T00:00:00.000Z",
        stripeSubscriptionId: "sub_123"
      })
    ).toBe("session-period:sub:sub_123:2026-08-01T00:00:00.000Z");
  });
});

describe("production sync opens period #1 without invoice-only gate", () => {
  it("Cloudflare sync initializes credits on active subscription even when paymentConfirmed is false", () => {
    const cf = readFileSync(join(__dirname, "../functions/_lib/stripeBilling.js"), "utf8");
    expect(cf).toContain("Period #1 opens when Stripe status is active/trialing");
    expect(cf).toContain("ensureSessionPeriodRow");
    expect(cf).toContain("grantSessionPeriodFromPaidInvoice");
    // Must not gate first-period ensure on confirmed alone.
    expect(cf).not.toMatch(
      /if \(active && confirmed && \(activePlanId === "plus" \|\| activePlanId === "pro"\) && periodStart && periodEnd\)/
    );
  });

  it("Node sync ensures period without waiting for paymentConfirmed", () => {
    const node = readFileSync(join(__dirname, "../server/lib/supabaseBillingSync.js"), "utf8");
    expect(node).toContain("Period #1 starts when Stripe marks the subscription active");
    expect(node).toContain("ensureSessionPeriodForActiveSubscription");
  });
});
