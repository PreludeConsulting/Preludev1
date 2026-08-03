import { describe, expect, it } from "vitest";
import { EXPLORE_COLLEGES } from "../../src/dashboard/data/collegeExploreData.js";
import { EXPLORE_COLLEGE_CATALOG } from "../../shared/exploreCollegesCatalog.js";
import { matchCollegesWithProfile } from "../../src/dashboard/data/collegeExploreData.js";

describe("manual college matching", () => {
  it("keeps EXPLORE_COLLEGES synchronized with the shared 85-college catalog", () => {
    expect(EXPLORE_COLLEGES).toHaveLength(85);
    expect(EXPLORE_COLLEGE_CATALOG).toHaveLength(85);
    expect(EXPLORE_COLLEGES.map((c) => c.id)).toEqual(EXPLORE_COLLEGE_CATALOG.map((c) => c.id));
  });

  it("uses structured location selections", () => {
    const recommendations = matchCollegesWithProfile({
      location: ["south"]
    });

    expect(recommendations.some((school) => school.region === "south")).toBe(true);
  });

  it("supports multiple selected budget ranges", () => {
    const recommendations = matchCollegesWithProfile({
      budget: ["value", "moderate"]
    });

    expect(recommendations).toHaveLength(6);
  });
});
