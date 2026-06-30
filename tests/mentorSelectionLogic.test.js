import { describe, expect, it } from "vitest";
import {
  canStudentSelectMentor,
  getMentorSelectionMode,
  MIN_MATCH_SCORE,
  MENTOR_ASSIGNMENT_STATUS,
  MENTOR_SELECTION_METHOD,
  requiresAdminReview,
  resolveMentorSelection,
  filterMatchedMentors
} from "../shared/mentorSelectionLogic.js";

describe("mentorSelectionLogic", () => {
  it("allows student selection only for exactly one or two matches", () => {
    expect(canStudentSelectMentor(0)).toBe(false);
    expect(canStudentSelectMentor(1)).toBe(true);
    expect(canStudentSelectMentor(2)).toBe(true);
    expect(canStudentSelectMentor(3)).toBe(false);
    expect(canStudentSelectMentor(5)).toBe(false);
  });

  it("requires admin review for zero or three plus matches", () => {
    expect(requiresAdminReview(0)).toBe(true);
    expect(requiresAdminReview(2)).toBe(false);
    expect(requiresAdminReview(3)).toBe(true);
  });

  it("accepts valid student selection", () => {
    const result = resolveMentorSelection({
      matchedMentorIds: ["a", "b"],
      matchedMentorCount: 2,
      selectedMentorId: "b"
    });
    expect(result.ok).toBe(true);
    expect(result.selectedMentorId).toBe("b");
    expect(result.mentorSelectionMethod).toBe(MENTOR_SELECTION_METHOD.STUDENT_SELECTED);
    expect(result.mentorAssignmentStatus).toBe(MENTOR_ASSIGNMENT_STATUS.STUDENT_SELECTED);
    expect(result.adminReviewRequired).toBe(false);
  });

  it("rejects missing selection when student must choose", () => {
    const result = resolveMentorSelection({
      matchedMentorIds: ["a"],
      matchedMentorCount: 1,
      selectedMentorId: null
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("mentor_required");
  });

  it("rejects mentors outside the matched list", () => {
    const result = resolveMentorSelection({
      matchedMentorIds: ["a"],
      matchedMentorCount: 1,
      selectedMentorId: "z"
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_mentor");
  });

  it("forces admin review when count is three or more even if client sends selectedMentorId", () => {
    const result = resolveMentorSelection({
      matchedMentorIds: ["a", "b", "c"],
      matchedMentorCount: 3,
      selectedMentorId: "a"
    });
    expect(result.ok).toBe(true);
    expect(result.rejectedClientSelection).toBe(true);
    expect(result.selectedMentorId).toBe(null);
    expect(result.mentorSelectionMethod).toBe(MENTOR_SELECTION_METHOD.ADMIN_REVIEW_REQUIRED);
    expect(result.adminReviewRequired).toBe(true);
  });

  it("filters mentors below the minimum match score", () => {
    const matched = filterMatchedMentors(
      [
        { id: "1", matchPercent: MIN_MATCH_SCORE },
        { id: "2", matchPercent: MIN_MATCH_SCORE - 1 }
      ],
      MIN_MATCH_SCORE
    );
    expect(matched.map((mentor) => mentor.id)).toEqual(["1"]);
  });

  it("maps selection modes", () => {
    expect(getMentorSelectionMode(1)).toBe("student_select");
    expect(getMentorSelectionMode(0)).toBe("no_matches");
    expect(getMentorSelectionMode(4)).toBe("admin_review");
  });
});
