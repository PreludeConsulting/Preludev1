import { describe, expect, it } from "vitest";
import { scoreMentorForStudent } from "../src/lib/mentorQuestionnaireService.js";

describe("mentor scoring", () => {
  it("gives completed mentors a baseline score above the match threshold", () => {
    const { score } = scoreMentorForStudent({}, {
      completed: true,
      specialties: [],
      target_majors: [],
      target_schools: [],
      support_styles: [],
      application_strengths: [],
      availability: "Weeknights"
    });
    expect(score).toBeGreaterThanOrEqual(58);
  });
});
