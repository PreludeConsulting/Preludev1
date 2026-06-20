import { describe, expect, it } from "vitest";
import { matchCollegesWithProfile } from "../../src/dashboard/data/collegeExploreData.js";

describe("manual college matching", () => {
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
