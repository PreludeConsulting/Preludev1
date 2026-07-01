/**
 * PreludeMatch mentor selection rules — shared by client UI and server validation.
 * Students may only manually select a mentor when matched_mentor_count is 1 or 2.
 */

export const MENTOR_SELECTION_METHOD = {
  STUDENT_SELECTED: "student_selected",
  ADMIN_REVIEW_REQUIRED: "admin_review_required"
};

export const MENTOR_ASSIGNMENT_STATUS = {
  STUDENT_SELECTED: "student_selected",
  ADMIN_REVIEW_REQUIRED: "admin_review_required",
  ADMIN_ASSIGNED: "admin_assigned"
};

/** Minimum match score for a mentor to count as a PreludeMatch result. */
export const MIN_MATCH_SCORE = 58;

export function effectiveMatchedMentorCount(matchedMentorCount, matchedMentorIds = [], mentorCardCount = 0) {
  const ids = Array.isArray(matchedMentorIds) ? matchedMentorIds.filter(Boolean) : [];
  const stored = Number.isFinite(matchedMentorCount) ? matchedMentorCount : 0;
  const cards = Number.isFinite(mentorCardCount) ? mentorCardCount : 0;
  return Math.max(stored, ids.length, cards);
}

export function canStudentSelectMentor(matchedMentorCount) {
  return matchedMentorCount === 1 || matchedMentorCount === 2;
}

export function requiresAdminReview(matchedMentorCount) {
  return matchedMentorCount === 0 || matchedMentorCount >= 3;
}

export function getMentorSelectionMode(matchedMentorCount) {
  if (canStudentSelectMentor(matchedMentorCount)) return "student_select";
  if (matchedMentorCount === 0) return "no_matches";
  return "admin_review";
}

export function getSelectionUiCopy(mode) {
  if (mode === "student_select") {
    return {
      heading: "Choose your mentor",
      subtext:
        "Based on your PreludeMatch quiz, we found the following mentor match options for you. Please choose the mentor you feel is the best fit."
    };
  }
  if (mode === "no_matches") {
    return {
      heading: "We're reviewing your match",
      subtext: "We're reviewing your PreludeMatch quiz results so we can find the best mentor for you."
    };
  }
  return {
    heading: "Your mentor matches",
    subtext:
      "Based on your PreludeMatch quiz, we found multiple strong mentor matches. Our team will review your results and help select the best mentor for you."
  };
}

/**
 * Resolve mentor selection payload from stored onboarding + optional client submission.
 * Rejects manipulated selectedMentorId when student selection is not allowed.
 */
export function resolveMentorSelection({
  matchedMentorIds = [],
  matchedMentorCount,
  selectedMentorId = null,
  now = new Date()
}) {
  const ids = Array.isArray(matchedMentorIds) ? matchedMentorIds.filter(Boolean) : [];
  const count = effectiveMatchedMentorCount(matchedMentorCount, ids);
  const timestamp = now.toISOString();

  if (canStudentSelectMentor(count)) {
    const normalizedId = selectedMentorId ? String(selectedMentorId) : null;
    if (!normalizedId) {
      return {
        ok: false,
        error: "mentor_required",
        message: "Select a mentor to continue."
      };
    }
    if (!ids.includes(normalizedId)) {
      return {
        ok: false,
        error: "invalid_mentor",
        message: "The selected mentor is not one of your PreludeMatch results."
      };
    }
    return {
      ok: true,
      selectedMentorId: normalizedId,
      mentorSelectionMethod: MENTOR_SELECTION_METHOD.STUDENT_SELECTED,
      mentorAssignmentStatus: MENTOR_ASSIGNMENT_STATUS.STUDENT_SELECTED,
      adminReviewRequired: false,
      matchedMentorCount: count,
      matchedMentorIds: ids,
      selectionTimestamp: timestamp
    };
  }

  if (selectedMentorId) {
    return {
      ok: true,
      rejectedClientSelection: true,
      selectedMentorId: null,
      mentorSelectionMethod: MENTOR_SELECTION_METHOD.ADMIN_REVIEW_REQUIRED,
      mentorAssignmentStatus: MENTOR_ASSIGNMENT_STATUS.ADMIN_REVIEW_REQUIRED,
      adminReviewRequired: true,
      matchedMentorCount: count,
      matchedMentorIds: ids,
      selectionTimestamp: timestamp
    };
  }

  return {
    ok: true,
    selectedMentorId: null,
    mentorSelectionMethod: MENTOR_SELECTION_METHOD.ADMIN_REVIEW_REQUIRED,
    mentorAssignmentStatus: MENTOR_ASSIGNMENT_STATUS.ADMIN_REVIEW_REQUIRED,
    adminReviewRequired: true,
    matchedMentorCount: count,
    matchedMentorIds: ids,
    selectionTimestamp: timestamp
  };
}

export function filterMatchedMentors(rankedMentors = [], minScore = MIN_MATCH_SCORE) {
  return rankedMentors.filter((mentor) => (mentor.matchPercent ?? mentor.score ?? 0) >= minScore);
}

/** Keep strong matches, but always return the top mentor when a live pool exists. */
export function finalizeMatchedMentors(rankedItems = [], minScore = MIN_MATCH_SCORE) {
  const rankedMentors = rankedItems.map((item) => {
    const mentor = item.mentor || item;
    const score = item.score ?? mentor.matchPercent ?? 0;
    return { ...mentor, matchPercent: score };
  });
  const matched = filterMatchedMentors(rankedMentors, minScore);
  if (matched.length || !rankedItems.length) return matched;
  const top = rankedItems[0];
  if (top?.mentor) {
    return [{ ...top.mentor, matchPercent: top.score ?? top.mentor.matchPercent }];
  }
  return rankedMentors[0] ? [rankedMentors[0]] : [];
}
