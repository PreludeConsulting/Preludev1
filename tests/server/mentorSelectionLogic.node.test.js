import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canStudentSelectMentor,
  resolveMentorSelection,
  MENTOR_SELECTION_METHOD
} from "../../shared/mentorSelectionLogic.js";

describe("mentor selection server rules", () => {
  it("rejects client-selected mentor when three or more matches", () => {
    const result = resolveMentorSelection({
      matchedMentorIds: ["a", "b", "c"],
      matchedMentorCount: 3,
      selectedMentorId: "a"
    });
    assert.equal(result.ok, true);
    assert.equal(result.selectedMentorId, null);
    assert.equal(result.mentorSelectionMethod, MENTOR_SELECTION_METHOD.ADMIN_REVIEW_REQUIRED);
    assert.equal(result.rejectedClientSelection, true);
  });

  it("accepts in-list mentor for two matches", () => {
    const result = resolveMentorSelection({
      matchedMentorIds: ["a", "b"],
      matchedMentorCount: 2,
      selectedMentorId: "b"
    });
    assert.equal(result.ok, true);
    assert.equal(result.selectedMentorId, "b");
    assert.equal(canStudentSelectMentor(2), true);
  });
});
