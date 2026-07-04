import { describe, expect, it } from "vitest";
import { US_MAP_VIEWBOX } from "../src/data/universityGeo.js";
import { buildStardustPoints } from "../src/lib/universityNetworkStardust.js";

describe("universityNetworkStardust", () => {
  it("returns a deterministic count for a fixed seed", () => {
    const a = buildStardustPoints({ width: US_MAP_VIEWBOX.width, height: US_MAP_VIEWBOX.height, count: 120, seed: 7 });
    const b = buildStardustPoints({ width: US_MAP_VIEWBOX.width, height: US_MAP_VIEWBOX.height, count: 120, seed: 7 });
    expect(a).toHaveLength(120);
    expect(a[0]).toEqual(b[0]);
  });

  it("keeps points inside the padded viewBox bounds", () => {
    for (const dot of buildStardustPoints({ width: 960, height: 560, count: 50, padding: 24 })) {
      expect(dot.x).toBeGreaterThanOrEqual(24);
      expect(dot.x).toBeLessThanOrEqual(936);
      expect(dot.y).toBeGreaterThanOrEqual(24);
      expect(dot.y).toBeLessThanOrEqual(536);
    }
  });
});
