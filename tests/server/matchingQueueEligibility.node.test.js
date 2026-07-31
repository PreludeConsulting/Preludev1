import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasSubmittedMatchingQuestionnaire,
  isStudentEligibleForMatchingQueue
} from "../../server/onboardingMentorSelectionApi.js";

function exactReportedState(overrides = {}) {
  return {
    profile: {
      role: "student",
      role_selection_complete: true,
      profile_complete: 0
    },
    onboarding: {
      onboarding_status: "match_completed",
      profile_complete: 0,
      mentor_matching_started: true,
      mentor_matching_complete: true,
      questionnaire_answers: { grade: "College", academicInterests: ["Computer Science"] },
      admin_review_required: true,
      matched_mentor_count: 0,
      mentor_assignment_status: null,
      ...overrides
    },
    hasFinalMentorMatch: false
  };
}

describe("Student Matching queue eligibility", () => {
  it("includes the exact reported zero-match state after automated matching completes", () => {
    assert.equal(isStudentEligibleForMatchingQueue(exactReportedState()), true);
  });

  it("excludes a student who has not submitted questionnaire answers", () => {
    assert.equal(
      isStudentEligibleForMatchingQueue(exactReportedState({ questionnaire_answers: {} })),
      false
    );
    assert.equal(hasSubmittedMatchingQuestionnaire(null), false);
  });

  it("excludes a completed final mentor assignment", () => {
    assert.equal(
      isStudentEligibleForMatchingQueue({
        ...exactReportedState(),
        hasFinalMentorMatch: true
      }),
      false
    );
    assert.equal(
      isStudentEligibleForMatchingQueue(exactReportedState({
        mentor_assignment_status: "admin_assigned"
      })),
      false
    );
  });

  it("excludes resolved admin review and non-student profiles", () => {
    assert.equal(
      isStudentEligibleForMatchingQueue(exactReportedState({ admin_review_required: false })),
      false
    );
    assert.equal(
      isStudentEligibleForMatchingQueue({
        ...exactReportedState(),
        profile: { role: "mentor", profile_complete: 100 }
      }),
      false
    );
  });
});
