import { describe, expect, it } from "vitest";
import { MAP_MOTION_MS, snapNetworkVisible } from "../src/lib/universityNetworkMapMotion.js";

describe("universityNetworkMapMotion", () => {
  it("exports draw and idle timing constants", () => {
    expect(MAP_MOTION_MS.draw).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.stagger).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.idlePulse).toBeGreaterThan(MAP_MOTION_MS.draw);
  });

  it("snapNetworkVisible is a no-op for empty lists", () => {
    expect(() => snapNetworkVisible([])).not.toThrow();
  });
});
