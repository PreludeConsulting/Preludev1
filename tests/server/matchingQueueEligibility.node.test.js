import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveMatchingDirectoryStatus,
  hasSubmittedMatchingQuestionnaire,
  isStudentEligibleForMatchingQueue,
  isStudentVisibleOnMatchingDirectory
} from "../../shared/matchingQueueEligibility.js";

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
      selected_mentor_id: null,
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

  it("excludes a completed final mentor assignment from the needs-review queue", () => {
    assert.equal(
      isStudentEligibleForMatchingQueue({
        ...exactReportedState(),
        hasFinalMentorMatch: true
      }),
      false
    );
    assert.equal(
      isStudentEligibleForMatchingQueue(exactReportedState({
        mentor_assignment_status: "admin_assigned",
        admin_review_required: false
      })),
      false
    );
  });

  it("excludes resolved admin review and non-student profiles from the needs-review queue", () => {
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

describe("Student Matching directory visibility", () => {
  it("keeps assigned students visible after admin assignment", () => {
    assert.equal(
      isStudentVisibleOnMatchingDirectory(exactReportedState({
        admin_review_required: false,
        mentor_assignment_status: "admin_assigned",
        selected_mentor_id: "mentor-1"
      })),
      true
    );
    assert.equal(
      deriveMatchingDirectoryStatus({
        admin_review_required: false,
        mentor_assignment_status: "admin_assigned",
        selected_mentor_id: "mentor-1"
      }),
      "assigned"
    );
  });

  it("keeps needs-review students visible", () => {
    assert.equal(isStudentVisibleOnMatchingDirectory(exactReportedState()), true);
    assert.equal(deriveMatchingDirectoryStatus(exactReportedState().onboarding), "needs_review");
  });

  it("hides students without questionnaire answers", () => {
    assert.equal(
      isStudentVisibleOnMatchingDirectory(exactReportedState({ questionnaire_answers: {} })),
      false
    );
  });

  it("hides mentor profiles from the student directory", () => {
    assert.equal(
      isStudentVisibleOnMatchingDirectory({
        ...exactReportedState({
          admin_review_required: false,
          mentor_assignment_status: "admin_assigned",
          selected_mentor_id: "mentor-1"
        }),
        profile: { role: "mentor", profile_complete: 100 }
      }),
      false
    );
  });
});
