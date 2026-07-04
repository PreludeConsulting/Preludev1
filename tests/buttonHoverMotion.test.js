import { describe, expect, it } from "vitest";
import { BUTTON_HOVER_MS, BUTTON_HOVER_SELECTOR, bindButtonHoverGlow } from "../src/lib/buttonHoverMotion.js";

describe("buttonHoverMotion", () => {
  it("exports primary CTA selector covering landing buttons", () => {
    expect(BUTTON_HOVER_SELECTOR).toContain(".shopify-hero__cta");
    expect(BUTTON_HOVER_SELECTOR).toContain(".pm-btn--primary");
    expect(BUTTON_HOVER_SELECTOR).toContain("[data-anime-hover=\"primary\"]");
    expect(BUTTON_HOVER_MS).toBeGreaterThan(0);
  });

  it("no-ops when reduced motion is enabled", () => {
    const el = { addEventListener() {}, removeEventListener() {}, contains: () => false };
    const cleanup = bindButtonHoverGlow(el, { reducedMotion: true });
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("no-ops for missing elements", () => {
    const cleanup = bindButtonHoverGlow(null, { reducedMotion: false });
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
