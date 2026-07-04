import { describe, expect, it } from "vitest";
import { UNIVERSITIES } from "../src/data/universities.js";
import {
  UNIVERSITY_GEO,
  US_MAP_VIEWBOX,
  US_NATION_PATH,
  getNetworkMapPoints,
  getUniversityCoordinateReport
} from "../src/data/universityGeo.js";

describe("universityGeo", () => {
  it("includes coordinates for every curated network university", () => {
    for (const school of UNIVERSITIES) {
      expect(UNIVERSITY_GEO[school.id], `missing geo for ${school.id}`).toBeTruthy();
    }
    expect(getNetworkMapPoints()).toHaveLength(UNIVERSITIES.length);
  });

  it("renders a real nation outline path from us-atlas", () => {
    expect(US_NATION_PATH.length).toBeGreaterThan(500);
    expect(US_NATION_PATH.startsWith("M")).toBe(true);
  });

  it("projects all schools inside the Albers USA viewBox", () => {
    for (const point of getNetworkMapPoints()) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(US_MAP_VIEWBOX.width);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(US_MAP_VIEWBOX.height);
    }
  });

  it("maps west coast schools left of east coast schools", () => {
    const stanford = getNetworkMapPoints().find((point) => point.id === "stanford");
    const harvard = getNetworkMapPoints().find((point) => point.id === "harvard");
    const rice = getNetworkMapPoints().find((point) => point.id === "rice");
    const michigan = getNetworkMapPoints().find((point) => point.id === "michigan");
    expect(stanford.x).toBeLessThan(harvard.x);
    expect(rice.y).toBeGreaterThan(michigan.y);
  });

  it("exposes a full coordinate report for all 25 schools", () => {
    const report = getUniversityCoordinateReport();
    expect(report).toHaveLength(UNIVERSITIES.length);
    expect(report.every((row) => row.lat && row.lon && row.x && row.y)).toBe(true);
  });
});
