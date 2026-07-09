import { describe, expect, it } from "vitest";
import { pickMentorNetworkCardTags } from "../src/lib/mentorNetworkCardTags.js";

describe("pickMentorNetworkCardTags", () => {
  const mentor = {
    id: "mentor-1",
    specialties: ["Choosing colleges", "Academic profile review", "Financial aid"]
  };

  it("returns up to 2 specialties from the help checklist only", () => {
    const tags = pickMentorNetworkCardTags(mentor);
    expect(tags).toHaveLength(2);
    expect(tags.every((tag) => mentor.specialties.includes(tag))).toBe(true);
  });

  it("keeps selection stable for the same mentor id", () => {
    expect(pickMentorNetworkCardTags(mentor)).toEqual(pickMentorNetworkCardTags(mentor));
  });

  it("returns one tag when only one specialty is selected", () => {
    expect(pickMentorNetworkCardTags({ id: "solo", specialties: ["Essay editing"] })).toEqual(["Essay editing"]);
  });

  it("returns no tags when no specialties are selected", () => {
    expect(pickMentorNetworkCardTags({ id: "empty", specialties: [] })).toEqual([]);
  });
});
