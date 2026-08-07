import { describe, expect, it } from "vitest";
import {
  resolveInvoiceSubscriptionPeriodBounds,
  resolveSubscriptionPeriodBounds,
  unixToIso
} from "../shared/stripeSubscriptionPeriod.js";
import { getPlanSessionAllowance } from "../server/lib/sessionCredits.js";

describe("resolveSubscriptionPeriodBounds (Stripe Basil+)", () => {
  it("reads top-level period fields when present", () => {
    expect(
      resolveSubscriptionPeriodBounds({
        current_period_start: 1_700_000_000,
        current_period_end: 1_700_268_000
      })
    ).toEqual({ startUnix: 1_700_000_000, endUnix: 1_700_268_000 });
  });

  it("falls back to subscription items when top-level fields are absent", () => {
    expect(
      resolveSubscriptionPeriodBounds({
        items: {
          data: [
            { current_period_start: 1_700_000_000, current_period_end: 1_700_268_000 },
            { current_period_start: 1_700_010_000, current_period_end: 1_700_250_000 }
          ]
        }
      })
    ).toEqual({
      startUnix: 1_700_000_000,
      endUnix: 1_700_268_000
    });
  });

  it("returns nulls when no period data exists", () => {
    expect(resolveSubscriptionPeriodBounds({ items: { data: [] } })).toEqual({
      startUnix: null,
      endUnix: null
    });
  });
});

describe("resolveInvoiceSubscriptionPeriodBounds", () => {
  it("prefers invoice line periods, then Basil item periods", () => {
    expect(
      resolveInvoiceSubscriptionPeriodBounds(
        {
          lines: {
            data: [{ period: { start: 100, end: 200 } }]
          }
        },
        { items: { data: [{ current_period_start: 300, current_period_end: 400 }] } }
      )
    ).toEqual({ startUnix: 100, endUnix: 200 });

    expect(
      resolveInvoiceSubscriptionPeriodBounds(
        { lines: { data: [{}] } },
        { items: { data: [{ current_period_start: 300, current_period_end: 400 }] } }
      )
    ).toEqual({ startUnix: 300, endUnix: 400 });
  });

  it("unixToIso converts seconds", () => {
    expect(unixToIso(1_700_000_000)).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(unixToIso(null)).toBeNull();
  });
});

describe("first membership period allowances", () => {
  it("uses configured Plus and Pro allowances", () => {
    expect(getPlanSessionAllowance("plus")).toBe(2);
    expect(getPlanSessionAllowance("pro")).toBe(4);
    expect(getPlanSessionAllowance("basic")).toBe(0);
  });
});
