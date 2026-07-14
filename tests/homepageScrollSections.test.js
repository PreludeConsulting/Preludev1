import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_SCROLL_SECTIONS,
  SECTION_MIN_ACTIVE_RATIO,
  SECTION_SWITCH_HYSTERESIS,
  getDocumentScrollProgress,
  getHomepageScrollState,
  getViewportDominance,
  lerpScrollProgress,
  resolveActiveScrollSection,
  resolveActiveSectionAtProgress,
  resolveActiveSectionByScrollProbe,
  resolveActiveSectionFromRatios,
  resolveSectionIndexAtRatio,
  resolveSectionIndexNearRatio
} from "../src/lib/homepageScrollSections.js";

const MOCK_SECTIONS = [
  { id: "home", label: "About", index: 0, top: 0, ratio: 0 },
  { id: "partners", label: "Partners", index: 1, top: 900, ratio: 0.25 },
  { id: "pricing", label: "Pricing", index: 2, top: 2700, ratio: 0.75 },
  { id: "contact", label: "Prelude", index: 3, top: 3600, ratio: 1 }
];

describe("homepageScrollSections", () => {
  it("lists ordered homepage sections with ids and labels", () => {
    expect(HOMEPAGE_SCROLL_SECTIONS.length).toBe(7);
    expect(HOMEPAGE_SCROLL_SECTIONS[0]).toEqual({ id: "home", label: "Hero" });
    expect(HOMEPAGE_SCROLL_SECTIONS.at(-1)).toEqual({ id: "contact", label: "Contact" });
    expect(HOMEPAGE_SCROLL_SECTIONS.some((section) => section.id === "mentorship")).toBe(true);
    expect(HOMEPAGE_SCROLL_SECTIONS.find((section) => section.id === "mentorship")?.label).toBe(
      "Mentors"
    );
    expect(HOMEPAGE_SCROLL_SECTIONS.some((section) => section.id === "how-it-works")).toBe(true);
    expect(HOMEPAGE_SCROLL_SECTIONS.find((section) => section.id === "bundles")).toEqual({
      id: "bundles",
      label: "Bundles"
    });
  });

  it("resolveActiveScrollSection returns a default when DOM is unavailable", () => {
    expect(resolveActiveScrollSection()).toEqual(HOMEPAGE_SCROLL_SECTIONS[0]);
  });

  it("getHomepageScrollState returns a default when DOM is unavailable", () => {
    expect(getHomepageScrollState()).toEqual({
      progress: 0,
      label: "Hero",
      activeIndex: 0
    });
  });

  it("getDocumentScrollProgress returns 0 when DOM is unavailable", () => {
    expect(getDocumentScrollProgress()).toBe(0);
  });

  it("resolveSectionIndexAtRatio snaps to the section start at or above the click ratio", () => {
    expect(resolveSectionIndexAtRatio(0.1, MOCK_SECTIONS)).toBe(0);
    expect(resolveSectionIndexAtRatio(0.5, MOCK_SECTIONS)).toBe(1);
    expect(resolveSectionIndexAtRatio(0.9, MOCK_SECTIONS)).toBe(2);
    expect(resolveSectionIndexAtRatio(1, MOCK_SECTIONS)).toBe(3);
  });

  it("resolveSectionIndexNearRatio returns -1 when no tick is within threshold", () => {
    expect(resolveSectionIndexNearRatio(0.5, MOCK_SECTIONS, 0.02)).toBe(-1);
  });

  it("resolveSectionIndexNearRatio returns the nearest tick within threshold", () => {
    expect(resolveSectionIndexNearRatio(0.26, MOCK_SECTIONS, 0.03)).toBe(1);
    expect(resolveSectionIndexNearRatio(0.74, MOCK_SECTIONS, 0.03)).toBe(2);
  });

  it("resolveActiveSectionFromRatios picks the highest dominance score", () => {
    const ratios = new Map([
      ["home", 0.35],
      ["partners", 0.45],
      ["pricing", 0.2]
    ]);

    expect(resolveActiveSectionFromRatios(ratios, MOCK_SECTIONS)).toBe(1);
  });

  it("resolveActiveSectionFromRatios ignores sections below the minimum ratio", () => {
    const ratios = new Map([
      ["home", 0.6],
      ["partners", SECTION_MIN_ACTIVE_RATIO - 0.02]
    ]);

    expect(resolveActiveSectionFromRatios(ratios, MOCK_SECTIONS)).toBe(0);
  });

  it("keeps the previous section active across an unlisted gap (testimonials)", () => {
    const ratios = new Map([
      ["partners", 0.35],
      ["pricing", 0.05]
    ]);

    expect(resolveActiveSectionFromRatios(ratios, MOCK_SECTIONS)).toBe(1);
  });

  it("resolveActiveSectionFromRatios breaks ties toward the topmost section", () => {
    const ratios = new Map([
      ["home", 0.4],
      ["partners", 0.4]
    ]);

    expect(resolveActiveSectionFromRatios(ratios, MOCK_SECTIONS)).toBe(0);
  });

  it("resolveActiveSectionFromRatios applies hysteresis at boundaries", () => {
    const ratios = new Map([
      ["home", 0.4],
      ["partners", 0.38]
    ]);

    expect(resolveActiveSectionFromRatios(ratios, MOCK_SECTIONS, 1)).toBe(1);

    const clearWin = new Map([
      ["home", 0.4 + SECTION_SWITCH_HYSTERESIS + 0.02],
      ["partners", 0.38]
    ]);

    expect(resolveActiveSectionFromRatios(clearWin, MOCK_SECTIONS, 1)).toBe(0);
  });

  it("resolveActiveSectionAtProgress aligns tick highlight with scroll fill", () => {
    expect(resolveActiveSectionAtProgress(0, MOCK_SECTIONS)).toBe(0);
    expect(resolveActiveSectionAtProgress(0.25, MOCK_SECTIONS)).toBe(1);
    expect(resolveActiveSectionAtProgress(0.74, MOCK_SECTIONS)).toBe(1);
    expect(resolveActiveSectionAtProgress(0.75, MOCK_SECTIONS)).toBe(2);
    expect(resolveActiveSectionAtProgress(1, MOCK_SECTIONS)).toBe(3);
    expect(resolveActiveSectionAtProgress(0.5, MOCK_SECTIONS)).toBe(1);
  });

  it("resolveActiveSectionFromRatios falls back to scroll probe when nothing intersects", () => {
    expect(resolveActiveSectionByScrollProbe(MOCK_SECTIONS)).toBe(0);
  });

  it("getViewportDominance measures center-band occupancy", () => {
    expect(
      getViewportDominance({
        isIntersecting: true,
        rootBounds: { height: 900, width: 1440 },
        boundingClientRect: { top: 225, bottom: 675, left: 0, right: 1440 }
      })
    ).toBeCloseTo(1, 5);

    expect(
      getViewportDominance({
        isIntersecting: true,
        rootBounds: { height: 900, width: 1440 },
        boundingClientRect: { top: 0, bottom: 200, left: 0, right: 1440 }
      })
    ).toBe(0);

    expect(getViewportDominance({ isIntersecting: false })).toBe(0);
    expect(getViewportDominance(null)).toBe(0);
  });

  it("lerpScrollProgress eases toward the target without overshooting", () => {
    expect(lerpScrollProgress(0, 1, 1)).toBe(1);
    expect(lerpScrollProgress(0, 1, 0.22)).toBeCloseTo(0.22, 5);
    expect(lerpScrollProgress(0.9, 1, 0.22)).toBeCloseTo(0.922, 3);
    expect(lerpScrollProgress(0.9999, 1, 0.22)).toBe(1);
  });
});
