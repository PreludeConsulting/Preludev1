import { describe, expect, it } from "vitest";
import { UNIVERSITIES } from "../src/data/universities.js";
import {
  NETWORK_HUB,
  UNIVERSITY_GEO,
  getNetworkMapPoints,
  projectLatLon,
  US_MAP_BOUNDS,
  US_MAP_VIEWBOX
} from "../src/data/universityGeo.js";

describe("universityGeo", () => {
  it("projects lat/lon inside the SVG viewBox", () => {
    const hub = projectLatLon(NETWORK_HUB.lat, NETWORK_HUB.lon);
    expect(hub.x).toBeGreaterThan(0);
    expect(hub.x).toBeLessThan(US_MAP_VIEWBOX.width);
    expect(hub.y).toBeGreaterThan(0);
    expect(hub.y).toBeLessThan(US_MAP_VIEWBOX.height);
  });

  it("includes coordinates for every curated network university", () => {
    for (const school of UNIVERSITIES) {
      expect(UNIVERSITY_GEO[school.id], `missing geo for ${school.id}`).toBeTruthy();
    }
    expect(getNetworkMapPoints()).toHaveLength(UNIVERSITIES.length);
  });

  it("keeps projected points inside continental bounds", () => {
    for (const point of getNetworkMapPoints()) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(US_MAP_VIEWBOX.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(US_MAP_VIEWBOX.height);
    }
  });

  it("maps west coast schools farther left than east coast schools", () => {
    const stanford = getNetworkMapPoints().find((point) => point.id === "stanford");
    const harvard = getNetworkMapPoints().find((point) => point.id === "harvard");
    expect(stanford.x).toBeLessThan(harvard.x);
    expect(stanford.x).toBeLessThan(
      projectLatLon(US_MAP_BOUNDS.minLat, US_MAP_BOUNDS.minLon).x + 200
    );
  });
});
