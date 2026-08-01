const FINAL_MENTOR_ASSIGNMENT_STATUSES = new Set(["admin_assigned", "student_selected"]);

export function hasSubmittedMatchingQuestionnaire(answers) {
  return Boolean(
    answers
    && typeof answers === "object"
    && !Array.isArray(answers)
    && Object.keys(answers).length
  );
}

export function isStudentEligibleForMatchingQueue({ onboarding, profile, hasFinalMentorMatch = false }) {
  if (String(profile?.role || "").toLowerCase() !== "student") return false;
  if (!hasSubmittedMatchingQuestionnaire(onboarding?.questionnaire_answers)) return false;
  if (onboarding?.admin_review_required !== true) return false;
  if (hasFinalMentorMatch) return false;
  if (FINAL_MENTOR_ASSIGNMENT_STATUSES.has(onboarding?.mentor_assignment_status)) return false;
  return true;
}
