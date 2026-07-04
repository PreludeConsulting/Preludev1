import { describe, expect, it } from "vitest";
import {
  COST_CURSOR_HOTSPOT,
  COST_CURSOR_MS,
  getTargetPoint,
  runCostBannerCursorLoop
} from "../src/lib/admissionsCostBannerMotion.js";

describe("admissionsCostBannerMotion", () => {
  it("exports cursor timing constants", () => {
    expect(COST_CURSOR_MS.toBadge).toBeGreaterThan(0);
    expect(COST_CURSOR_HOTSPOT.x).toBeGreaterThan(0);
  });

  it("computes target points relative to the section", () => {
    const section = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 })
    };
    const target = {
      getBoundingClientRect: () => ({ left: 200, top: 100, width: 40, height: 20 })
    };

    const point = getTargetPoint(section, target);
    expect(point.x).toBe(220 - COST_CURSOR_HOTSPOT.x);
    expect(point.y).toBe(110 - COST_CURSOR_HOTSPOT.y);
  });

  it("runCostBannerCursorLoop returns a cancellable controller", () => {
    const controller = runCostBannerCursorLoop({ reducedMotion: true });
    expect(() => controller.cancel()).not.toThrow();
  });
});
