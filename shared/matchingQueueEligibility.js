const FINAL_MENTOR_ASSIGNMENT_STATUSES = new Set(["admin_assigned", "student_selected"]);
export const FINAL_MENTOR_MATCH_STATUSES = Object.freeze(["assigned", "accepted", "active"]);

export function hasSubmittedMatchingQuestionnaire(answers) {
  return Boolean(
    answers
    && typeof answers === "object"
    && !Array.isArray(answers)
    && Object.keys(answers).length
  );
}

/**
 * Strict queue: students who still need Matching Team review / first assignment.
 * Used when a caller only wants unresolved cases.
 */
export function isStudentEligibleForMatchingQueue({ onboarding, profile, hasFinalMentorMatch = false }) {
  if (String(profile?.role || "").toLowerCase() !== "student") return false;
  if (!hasSubmittedMatchingQuestionnaire(onboarding?.questionnaire_answers)) return false;
  if (onboarding?.admin_review_required !== true) return false;
  if (hasFinalMentorMatch) return false;
  if (FINAL_MENTOR_ASSIGNMENT_STATUSES.has(onboarding?.mentor_assignment_status)) return false;
  return true;
}

/**
 * Matching Team directory: keep both unassigned (needs review) and assigned students
 * so admins can review or reassign without losing the row after assignment.
 */
export function isStudentVisibleOnMatchingDirectory({ onboarding, profile }) {
  if (String(profile?.role || "").toLowerCase() !== "student") return false;
  if (!hasSubmittedMatchingQuestionnaire(onboarding?.questionnaire_answers)) return false;

  if (onboarding?.admin_review_required === true) return true;
  if (FINAL_MENTOR_ASSIGNMENT_STATUSES.has(onboarding?.mentor_assignment_status)) return true;
  if (onboarding?.selected_mentor_id) return true;
  return false;
}

export function deriveMatchingDirectoryStatus(onboarding = {}, { hasFinalMentorMatch = false } = {}) {
  if (onboarding?.admin_review_required === true) return "needs_review";
  if (
    onboarding?.selected_mentor_id
    || FINAL_MENTOR_ASSIGNMENT_STATUSES.has(onboarding?.mentor_assignment_status)
    || hasFinalMentorMatch
  ) {
    return "assigned";
  }
  return "unmatched";
}
