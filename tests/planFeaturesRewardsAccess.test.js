import { describe, expect, it } from "vitest";
import {
  canAccessFeature,
  getEffectiveUserPlan,
  getUserPlan
} from "../src/lib/planFeatures.js";

describe("Progress Rewards plan access", () => {
  it("gates rewards behind Plus", () => {
    expect(canAccessFeature("basic", "rewards")).toBe(false);
    expect(canAccessFeature("plus", "rewards")).toBe(true);
    expect(canAccessFeature("pro", "rewards")).toBe(true);
  });

  it("keeps Pro Boost on Pro only", () => {
    expect(canAccessFeature("plus", "advancedRewards")).toBe(false);
    expect(canAccessFeature("pro", "advancedRewards")).toBe(true);
  });

  it("prefers active billing Plus over a stale profile plan", () => {
    expect(getUserPlan({ plan: "basic" })).toBe("basic");
    expect(
      getEffectiveUserPlan(
        { plan: "basic" },
        { isActive: true, activePlanId: "plus" }
      )
    ).toBe("plus");
    expect(
      canAccessFeature(
        getEffectiveUserPlan({ plan: "basic" }, { isActive: true, activePlanId: "plus" }),
        "rewards"
      )
    ).toBe(true);
  });

  it("does not unlock rewards from inactive subscription alone", () => {
    expect(
      getEffectiveUserPlan(
        { plan: "basic" },
        { isActive: false, activePlanId: "plus" }
      )
    ).toBe("basic");
  });
});
