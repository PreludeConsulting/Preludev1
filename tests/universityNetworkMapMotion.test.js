import { describe, expect, it } from "vitest";
import { MAP_MOTION_MS, snapNetworkVisible, snapStardustVisible } from "../src/lib/universityNetworkMapMotion.js";

describe("universityNetworkMapMotion", () => {
  it("exports draw and idle timing constants", () => {
    expect(MAP_MOTION_MS.draw).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.stagger).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.idlePulse).toBeGreaterThan(MAP_MOTION_MS.draw);
    expect(MAP_MOTION_MS.hubBreathe).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.stardustTwinkle).toBeGreaterThan(MAP_MOTION_MS.hubBreathe);
  });

  it("snap helpers tolerate empty lists", () => {
    expect(() => snapNetworkVisible([])).not.toThrow();
    expect(() => snapStardustVisible([])).not.toThrow();
  });
});
