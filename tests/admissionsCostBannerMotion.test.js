import { describe, expect, it } from "vitest";
import {
  COST_FAKE_CURSOR_HOTSPOT,
  easeOutCubic,
  elementCenterPoint,
  elementPointInSection,
  formatSavingsAmount,
  getCostFakeCursorPath,
  pointInSection,
  savingsCountValue,
  SAVINGS_COUNT_DURATION_MS,
  SAVINGS_TARGET_AMOUNT
} from "../src/lib/admissionsCostBannerMotion.js";

describe("admissionsCostBannerMotion", () => {
  it("formats the savings amount with dollar grouping", () => {
    expect(formatSavingsAmount(0)).toBe("$0");
    expect(formatSavingsAmount(6500)).toBe("$6,500");
  });

  it("counts from zero to the target savings amount", () => {
    expect(savingsCountValue(0)).toBe(0);
    expect(savingsCountValue(SAVINGS_COUNT_DURATION_MS)).toBe(SAVINGS_TARGET_AMOUNT);
    expect(savingsCountValue(SAVINGS_COUNT_DURATION_MS * 2)).toBe(SAVINGS_TARGET_AMOUNT);
  });

  it("uses an eased count-up so the displayed value visibly changes", () => {
    const quarter = savingsCountValue(SAVINGS_COUNT_DURATION_MS / 4);
    const half = savingsCountValue(SAVINGS_COUNT_DURATION_MS / 2);

    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
    expect(quarter).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(quarter);
    expect(half).toBeLessThan(SAVINGS_TARGET_AMOUNT);
  });

  it("computes the center point for the coin burst origin", () => {
    const element = {
      getBoundingClientRect: () => ({ left: 20, top: 10, width: 100, height: 40 })
    };

    expect(elementCenterPoint(element)).toEqual({ x: 70, y: 30 });
    expect(elementCenterPoint(null)).toBeNull();
  });

  it("computes fake cursor points relative to the cost section", () => {
    const section = {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 400 })
    };
    const amount = {
      getBoundingClientRect: () => ({ left: 500, top: 170, width: 120, height: 48 })
    };
    const headline = {
      getBoundingClientRect: () => ({ left: 460, top: 240, width: 360, height: 120 })
    };

    expect(pointInSection(section, 0.5, 0.5)).toEqual({
      x: 400 - COST_FAKE_CURSOR_HOTSPOT.x,
      y: 200 - COST_FAKE_CURSOR_HOTSPOT.y
    });
    expect(elementPointInSection(section, amount)).toEqual({
      x: 460 - COST_FAKE_CURSOR_HOTSPOT.x,
      y: 144 - COST_FAKE_CURSOR_HOTSPOT.y
    });

    const path = getCostFakeCursorPath(section, amount, headline);
    expect(path.amount).toEqual(elementPointInSection(section, amount));
    expect(path.entry.x).toBeLessThan(0);
    expect(path.amount.x).toBeGreaterThan(path.entry.x);
    expect(path.exit).toEqual(path.amount);
  });
});
