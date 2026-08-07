/**
 * Prelude Match — scoring, mentor lookup, onboarding persistence helpers.
 * Entitlement columns and mentor_matches are written only by service-role APIs.
 */

import { PRELUDE_MATCH_MENTORS } from "../data/preludeMatchMentors.js";
import { getSupabase } from "./supabase.js";
import { ONBOARDING_STATUS } from "./onboardingRoutes.js";
import { getMentorMatchingProfile, mapMentorMatchingProfile, rankSupabaseMentorsForStudent } from "./mentorQuestionnaireService.js";
import { finalizeMatchedMentors, MIN_MATCH_SCORE, effectiveMatchedMentorCount } from "../../shared/mentorSelectionLogic.js";
import { saveMentorSelection } from "./mentorSelectionApi.js";

const MENTOR_CATALOG = PRELUDE_MATCH_MENTORS.map((m) => ({
  ...m,
  university: m.school,
  tags: m.specialties || m.tags || [],
  expertise: m.specialties || m.tags || [],
  bio: m.reason,
  meetingFormat: "Video or in-person",
  language: "English",
  supportAreas: m.specialties || m.tags || []
}));

export function getMentorCatalog() {
  return MENTOR_CATALOG;
}

export function getMentorById(id) {
  return MENTOR_CATALOG.find((m) => m.id === id) || null;
}

/** Score mentors from questionnaire answers (demo catalog). */
export function rankMentors(answers = {}) {
  const interests = answers.academicInterests || answers.intendedMajor || [];
  const helpAreas = answers.helpAreas || answers.supportAreas || [];
  const interestList = Array.isArray(interests) ? interests : [interests].filter(Boolean);
  const helpList = Array.isArray(helpAreas) ? helpAreas : [helpAreas].filter(Boolean);

  return [...MENTOR_CATALOG]
    .map((mentor) => {
      let score = mentor.matchPercent || 80;
      const tags = (mentor.specialties || mentor.tags || []).map((t) => t.toLowerCase());
      interestList.forEach((item) => {
        const lower = String(item).toLowerCase();
        if (tags.some((t) => lower.includes(t) || t.includes(lower.split(" ")[0]))) score += 4;
        if (mentor.major?.toLowerCase().includes(lower.split(" ")[0])) score += 3;
      });
      helpList.forEach((item) => {
        const lower = String(item).toLowerCase();
        if (tags.some((t) => lower.includes(t.split(" ")[0]))) score += 3;
      });
      return { ...mentor, matchPercent: Math.min(99, score) };
    })
    .sort((a, b) => b.matchPercent - a.matchPercent);
}

export function rankDemoMatchedMentors(answers = {}) {
  const ranked = rankMentors(answers).map((mentor) => ({ mentor, score: mentor.matchPercent }));
  return finalizeMatchedMentors(ranked, MIN_MATCH_SCORE);
}

export async function resolveStudentMentorMatches(userId, answers = {}) {
  const supabaseResult = await rankSupabaseMentorsForStudent(userId, answers);
  if (supabaseResult.matchedMentors?.length) {
    const ids = supabaseResult.matchedMentorIds || [];
    return {
      matchedMentors: supabaseResult.matchedMentors,
      matchedMentorIds: ids,
      matchedMentorCount: effectiveMatchedMentorCount(supabaseResult.matchedMentorCount, ids, supabaseResult.matchedMentors.length),
      source: "supabase",
      error: supabaseResult.error || null
    };
  }

  const demoMatches = rankDemoMatchedMentors(answers);
  if (demoMatches.length) {
    const ids = demoMatches.map((mentor) => mentor.id);
    return {
      matchedMentors: demoMatches,
      matchedMentorIds: ids,
      matchedMentorCount: demoMatches.length,
      source: "demo",
      error: supabaseResult.error || null
    };
  }

  return {
    matchedMentors: [],
    matchedMentorIds: [],
    matchedMentorCount: 0,
    source: "none",
    error: supabaseResult.error || null
  };
}

export function pickSuggestedMentor(answers) {
  return rankDemoMatchedMentors(answers)[0] || rankMentors(answers)[0] || MENTOR_CATALOG[0];
}

export async function getSuggestedMentor(id) {
  const catalogMentor = getMentorById(id);
  if (catalogMentor) return catalogMentor;
  const { mentor } = await getMentorMatchingProfile(id);
  return mentor;
}

export async function loadOnboardingProgress(userId) {
  const { data, error } = await getSupabase()
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { onboarding: null, error: error.message };
  return { onboarding: data, error: null };
}

/**
 * Draft-only questionnaire answers. Entitlement flags are set by /api/prelude-match/submit.
 */
export async function markMatchQuestionnaireComplete(userId, answers = null) {
  const existing = await loadOnboardingProgress(userId);
  const preservedAnswers =
    answers && typeof answers === "object" && Object.keys(answers).length
      ? answers
      : existing.onboarding?.questionnaire_answers &&
          Object.keys(existing.onboarding.questionnaire_answers).length
        ? existing.onboarding.questionnaire_answers
        : {};

  const payload = {
    user_id: userId,
    questionnaire_answers: preservedAnswers,
    mentor_matching_started: true,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await getSupabase()
    .from("onboarding_progress")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  return {
    onboarding: data,
    suggestedMentor: null,
    matchedMentors: [],
    matchedMentorCount: 0,
    matchedMentorIds: [],
    error: error?.message || null
  };
}

/** @deprecated Prefer markMatchQuestionnaireComplete — answers are stored by the submit API. */
export async function saveMatchQuestionnaire(userId, answers) {
  return markMatchQuestionnaireComplete(userId, answers);
}

/** Route mentor acceptance through the mentor-selection API (service-role writes). */
export async function saveMatchDecision(userId, { decision, mentorId, declinedIds = [] }) {
  void declinedIds;
  if (decision === "accepted" && mentorId) {
    try {
      const result = await saveMentorSelection({ selectedMentorId: mentorId });
      return { onboarding: result?.onboarding || null, error: null };
    } catch (error) {
      return { error: error?.message || "Could not save mentor selection." };
    }
  }

  // Declines no longer write entitlement columns from the client.
  const { onboarding } = await loadOnboardingProgress(userId);
  return { onboarding, error: null };
}

/** @deprecated Prefer saveMentorSelection — mentor_matches are service-role only. */
export async function requestMentorMatch(_userId, mentorId) {
  if (!mentorId) return { error: "Mentor not found." };
  try {
    await saveMentorSelection({ selectedMentorId: mentorId });
    return { error: null };
  } catch (error) {
    return { error: error?.message || "Could not request mentor match." };
  }
}

function mapMentorSelectionState(onboarding, mentors = []) {
  const matchedIds = onboarding?.matched_mentor_ids || [];
  const matchedMentorCount = effectiveMatchedMentorCount(
    onboarding?.matched_mentor_count,
    matchedIds,
    mentors.length
  );
  return {
    matchedMentorCount,
    matchedMentorIds: matchedIds,
    mentors,
    selectedMentorId: onboarding?.selected_mentor_id || null,
    mentorSelectionMethod: onboarding?.mentor_selection_method || null,
    mentorAssignmentStatus: onboarding?.mentor_assignment_status || null,
    adminReviewRequired: Boolean(onboarding?.admin_review_required),
    mentorSelectionComplete: Boolean(onboarding?.mentor_assignment_status),
    selectionTimestamp: onboarding?.mentor_selection_timestamp || null,
    preludeMatchCompleted: Boolean(onboarding?.prelude_match_completed ?? onboarding?.mentor_matching_complete)
  };
}

async function loadMatchedMentorCards(userId, matchedIds = []) {
  if (!matchedIds.length) return [];
  const supabase = getSupabase();
  const [{ data: rows }, { data: scores }] = await Promise.all([
    supabase.from("mentor_matching_profiles").select("*").in("mentor_user_id", matchedIds),
    supabase
      .from("mentor_match_scores")
      .select("mentor_user_id, score, reasons")
      .eq("student_user_id", userId)
      .in("mentor_user_id", matchedIds)
  ]);
  const scoreById = Object.fromEntries((scores || []).map((entry) => [entry.mentor_user_id, entry]));
  return matchedIds
    .map((id) => {
      const row = (rows || []).find((entry) => entry.mentor_user_id === id);
      if (!row) return null;
      const scoreRow = scoreById[id];
      return mapMentorMatchingProfile(row, scoreRow?.score ?? null, scoreRow?.reasons || []);
    })
    .filter(Boolean);
}

/** @deprecated Prefer loadMentorSelectionState from mentorSelectionApi.js */
export async function loadMentorSelectionStateDirect(userId) {
  let { onboarding, error } = await loadOnboardingProgress(userId);
  if (error) throw new Error(error);
  if (!onboarding?.mentor_matching_complete) {
    throw new Error("Complete the PreludeMatch quiz first.");
  }

  let matchedIds = onboarding.matched_mentor_ids || [];
  let mentors = await loadMatchedMentorCards(userId, matchedIds);

  if (!mentors.length && onboarding.suggested_mentor_id && !matchedIds.length) {
    matchedIds = [onboarding.suggested_mentor_id];
    mentors = await loadMatchedMentorCards(userId, matchedIds);
  }

  return mapMentorSelectionState(onboarding, mentors);
}

/** @deprecated Prefer saveMentorSelection from mentorSelectionApi.js */
export async function saveMentorSelectionDirect(userId, { selectedMentorId = null } = {}) {
  void userId;
  return saveMentorSelection({ selectedMentorId });
}

export function mapOnboardingToUserFields(onboarding, hasAssignedMentor) {
  if (!onboarding) {
    return {
      matchOnboardingComplete: false,
      matchDecision: null,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_MATCH,
      suggestedMentorId: null,
      parentInviteStepComplete: false,
      paymentStepComplete: false,
      mentorSelectionComplete: false,
      matchedMentorCount: 0,
      matchedMentorIds: [],
      selectedMentorId: null,
      mentorSelectionMethod: null,
      mentorAssignmentStatus: null,
      adminReviewRequired: false
    };
  }

  const mentorSelectionComplete = Boolean(onboarding.mentor_assignment_status);
  let status;

  if (!onboarding.mentor_matching_complete) {
    status = ONBOARDING_STATUS.NEEDS_MATCH;
  } else if (!onboarding.parent_invite_step_completed) {
    status = ONBOARDING_STATUS.MATCH_COMPLETED;
  } else if (!onboarding.payment_step_completed) {
    status = ONBOARDING_STATUS.NEEDS_PAYMENT;
  } else if (mentorSelectionComplete || hasAssignedMentor || onboarding.match_decision === "accepted") {
    status = ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  } else if (
    onboarding.match_decision === "declined" ||
    onboarding.suggested_mentor_id ||
    onboarding.prelude_match_completed
  ) {
    status = ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  } else {
    status = ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  }

  return {
    matchOnboardingComplete: Boolean(onboarding.mentor_matching_complete),
    matchDecision: onboarding.match_decision || null,
    onboardingStatus: status,
    suggestedMentorId: onboarding.suggested_mentor_id || null,
    questionnaireAnswers: onboarding.questionnaire_answers || {},
    parentInviteStepComplete: Boolean(onboarding.parent_invite_step_completed),
    paymentStepComplete: Boolean(onboarding.payment_step_completed),
    mentorSelectionComplete,
    matchedMentorCount: onboarding.matched_mentor_count ?? (onboarding.matched_mentor_ids || []).length,
    matchedMentorIds: onboarding.matched_mentor_ids || [],
    selectedMentorId: onboarding.selected_mentor_id || null,
    mentorSelectionMethod: onboarding.mentor_selection_method || null,
    mentorAssignmentStatus: onboarding.mentor_assignment_status || null,
    adminReviewRequired: Boolean(onboarding.admin_review_required),
    preludeMatchCompleted: Boolean(onboarding.prelude_match_completed ?? onboarding.mentor_matching_complete)
  };
}
