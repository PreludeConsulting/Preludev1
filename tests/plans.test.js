import { describe, expect, it } from "vitest";
import { getPlan, normalizePlanId } from "../src/lib/plans.js";

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
});
