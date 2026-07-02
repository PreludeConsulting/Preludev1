import { describe, expect, it } from "vitest";
import {
  isEligibleMentorProfile,
  isMentorProfileReadable,
  rankMentorRowsForStudent
} from "../shared/mentorMatching.js";

const MENTOR_ID = "11111111-1111-1111-1111-111111111111";
const STUDENT_ID = "22222222-2222-2222-2222-222222222222";

function profile(overrides = {}) {
  return {
    mentor_user_id: MENTOR_ID,
    display_name: "Alex Mentor",
    college: "State University",
    major: "Computer Science",
    completed: false,
    specialties: ["Essays"],
    target_majors: ["Computer Science"],
    target_schools: ["State University"],
    support_styles: ["Structured step-by-step guidance"],
    application_strengths: ["Essays"],
    ...overrides
  };
}

describe("mentor matching profile visibility", () => {
  it("lets mentors always read their own profile", () => {
    const row = profile({ display_name: "", college: "", major: "", completed: false });
    expect(isMentorProfileReadable(row, MENTOR_ID)).toBe(true);
    expect(isEligibleMentorProfile(row)).toBe(false);
  });

  it("lets authenticated students read completed mentor profiles", () => {
    const row = profile({ completed: true, display_name: "", college: "", major: "" });
    expect(isMentorProfileReadable(row, STUDENT_ID)).toBe(true);
    expect(isEligibleMentorProfile(row)).toBe(true);
  });

  it("lets authenticated students read incomplete profiles with display name, college, and major", () => {
    const row = profile({ completed: false });
    expect(isMentorProfileReadable(row, STUDENT_ID)).toBe(true);
    expect(isEligibleMentorProfile(row)).toBe(true);
  });

  it("hides incomplete profiles missing any PreludeMatch core field from other users", () => {
    expect(isMentorProfileReadable(profile({ display_name: "" }), STUDENT_ID)).toBe(false);
    expect(isMentorProfileReadable(profile({ college: "  " }), STUDENT_ID)).toBe(false);
    expect(isMentorProfileReadable(profile({ major: null }), STUDENT_ID)).toBe(false);
    expect(isMentorProfileReadable(profile({ mentor_user_id: null }), STUDENT_ID)).toBe(false);
  });

  it("treats whitespace-only core fields as missing", () => {
    const row = profile({ display_name: "  ", college: "State", major: "CS" });
    expect(isMentorProfileReadable(row, STUDENT_ID)).toBe(false);
  });
});

describe("mentor matching ranking", () => {
  it("includes incomplete mentors once display name, college, and major are present", () => {
    const incomplete = profile({ completed: false, bio: "" });
    const { matched } = rankMentorRowsForStudent(
      { academicInterests: ["Computer Science"], helpAreas: ["Essays"] },
      [incomplete]
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].id).toBe(MENTOR_ID);
  });

  it("excludes mentors without enough profile data for PreludeMatch", () => {
    const hidden = profile({ display_name: "", college: "", major: "" });
    const { matched } = rankMentorRowsForStudent({}, [hidden]);
    expect(matched).toHaveLength(0);
  });
});
