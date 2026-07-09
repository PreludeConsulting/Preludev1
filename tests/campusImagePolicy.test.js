import { describe, expect, it } from "vitest";
import {
  buildCampusSearchQueries,
  getSchoolTitleTokens,
  pickBestCampusSearchHit,
  scoreCampusImageTitle,
  titleMatchesSchool
} from "../scripts/campusImagePolicy.mjs";

describe("campusImagePolicy", () => {
  it("prefers aerial campus titles over city skylines", () => {
    const tokens = getSchoolTitleTokens("stanford", "Stanford University");
    expect(scoreCampusImageTitle("Stanford University campus aerial view.jpg", tokens)).toBeGreaterThan(
      scoreCampusImageTitle("San Francisco skyline from Twin Peaks.jpg", tokens)
    );
    expect(scoreCampusImageTitle("San Francisco skyline from Twin Peaks.jpg", tokens)).toBe(-1);
  });

  it("rejects logos, stadiums, student photos, and wrong schools", () => {
    const columbia = getSchoolTitleTokens("columbia", "Columbia University");
    expect(scoreCampusImageTitle("Harvard University logo.svg", columbia)).toBe(-1);
    expect(scoreCampusImageTitle("Ohio Stadium game day crowd.jpg", columbia)).toBe(-1);
    expect(scoreCampusImageTitle("College students studying in classroom.jpg", columbia)).toBe(-1);
    expect(
      scoreCampusImageTitle("University of British Columbia, north end of campus, aerial from northeast.jpg", columbia)
    ).toBe(-1);
  });

  it("builds aerial-first search queries", () => {
    const queries = buildCampusSearchQueries("Duke University");
    expect(queries[0]).toMatch(/aerial/i);
    expect(queries.some((query) => /campus/i.test(query))).toBe(true);
  });

  it("picks the highest-scoring commons search result for the correct school", () => {
    const tokens = getSchoolTitleTokens("duke", "Duke University");
    const best = pickBestCampusSearchHit(
      [
        { title: "File:Downtown Durham skyline.jpg" },
        { title: "File:Duke University West Campus aerial view.jpg" },
        { title: "File:Duke University logo.svg" }
      ],
      tokens
    );
    expect(best.title).toContain("Duke University");
    expect(titleMatchesSchool(best.title, tokens)).toBe(true);
  });
});
