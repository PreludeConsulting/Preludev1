import { describe, expect, it } from "vitest";
import {
  US_MAP_VIEWBOX,
  US_NATION_PATH,
  US_STATE_PATHS,
  US_STATES_MESH_PATH,
  projectGeoPoint
} from "../src/lib/usMapGeo.js";

describe("usMapGeo", () => {
  it("fits the nation and states into the viewBox", () => {
    expect(US_MAP_VIEWBOX.width).toBeGreaterThan(900);
    expect(US_STATE_PATHS.length).toBeGreaterThan(40);
    expect(US_NATION_PATH.length).toBeGreaterThan(500);
    expect(US_STATES_MESH_PATH.length).toBeGreaterThan(500);
  });

  it("projects continental cities through geoAlbersUsa", () => {
    const la = projectGeoPoint(-118.2437, 34.0522);
    const boston = projectGeoPoint(-71.0589, 42.3601);
    const houston = projectGeoPoint(-95.3698, 29.7604);
    expect(la && boston && houston).toBeTruthy();
    expect(la.x).toBeLessThan(boston.x);
    expect(houston.y).toBeGreaterThan(boston.y);
  });
});
