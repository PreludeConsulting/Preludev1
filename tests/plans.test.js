import { describe, expect, it } from "vitest";
import { PLAN_BADGE_TYPES, getPlanBadgeLabel, getPlanBadgeType } from "../src/lib/planBadges.js";
import { getPlan, normalizePlanId, PLANS } from "../src/lib/plans.js";

describe("plan helpers", () => {
  it("normalizes internal ids and display names", () => {
    expect(normalizePlanId("basic")).toBe("basic");
    expect(normalizePlanId("Basic")).toBe("basic");
    expect(normalizePlanId("  PLUS  ")).toBe("plus");
    expect(normalizePlanId("Pro")).toBe("pro");
  });

  it("returns null for missing or unknown plan ids", () => {
    expect(normalizePlanId(null)).toBeNull();
    expect(normalizePlanId("")).toBeNull();
    expect(normalizePlanId("student")).toBeNull();
  });

  it("keeps getPlan backwards-compatible with display names", () => {
    expect(getPlan("Basic").id).toBe("basic");
  });

  it("resolves semantic badge types for eligible plan ids", () => {
    expect(PLAN_BADGE_TYPES).toEqual({ plus: "mostPopular", pro: "bestValue" });
    expect(Object.isFrozen(PLAN_BADGE_TYPES)).toBe(true);
    expect(getPlanBadgeType("basic")).toBeNull();
    expect(getPlanBadgeType("plus")).toBe("mostPopular");
    expect(getPlanBadgeType("pro")).toBe("bestValue");
  });

  it("resolves badge labels in supported locales and falls back to English", () => {
    expect(getPlanBadgeLabel("plus", "en")).toBe("Most Popular");
    expect(getPlanBadgeLabel("pro", "en")).toBe("Best Value");
    expect(getPlanBadgeLabel("plus", "ko")).toBe("가장 인기");
    expect(getPlanBadgeLabel("pro", "ko")).toBe("최고의 가치");
    expect(getPlanBadgeLabel("plus", "zh")).toBe("最受欢迎");
    expect(getPlanBadgeLabel("pro", "zh")).toBe("超值之选");
    expect(getPlanBadgeLabel("plus", "es")).toBe("Más popular");
    expect(getPlanBadgeLabel("pro", "es")).toBe("Mejor valor");
    expect(getPlanBadgeLabel("plus", "unsupported")).toBe("Most Popular");
    expect(getPlanBadgeLabel("basic", "en")).toBeNull();
  });

  it("uses isFeatured only for existing visual emphasis", () => {
    expect(PLANS.pro.isFeatured).toBe(true);
    expect(PLANS.plus.isFeatured).toBe(false);
    expect(PLANS.basic.isFeatured).toBe(false);
    expect(Object.values(PLANS).some((plan) => "isRecommended" in plan)).toBe(false);
  });

  it("owns billing benefits in the central plan catalog", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.billingHighlights.length).toBeGreaterThan(0);
      expect(plan.billingHighlights.every((benefit) => typeof benefit === "string" && benefit.length > 0)).toBe(true);
    }
  });
});
