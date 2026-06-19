/**
 * Prelude Match — scoring, mentor lookup, onboarding persistence helpers.
 */

import { PRELUDE_MATCH_MENTORS } from "../data/preludeMatchMentors.js";
import { getSupabase } from "./supabase.js";
import { ONBOARDING_STATUS } from "./onboardingRoutes.js";

const MENTOR_CATALOG = PRELUDE_MATCH_MENTORS.map((m) => ({
  ...m,
  university: m.school,
  expertise: m.tags || [],
  bio: m.reason,
  meetingFormat: "Video or in-person",
  language: "English",
  supportAreas: m.tags || []
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
      const tags = (mentor.tags || []).map((t) => t.toLowerCase());
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

export function pickSuggestedMentor(answers) {
  return rankMentors(answers)[0] || MENTOR_CATALOG[0];
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

export async function saveMatchQuestionnaire(userId, answers) {
  const suggested = pickSuggestedMentor(answers);
  const payload = {
    user_id: userId,
    questionnaire_answers: answers,
    mentor_matching_started: true,
    mentor_matching_complete: true,
    suggested_mentor_id: suggested.id,
    onboarding_status: ONBOARDING_STATUS.MATCH_COMPLETED,
    match_decision: null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await getSupabase()
    .from("onboarding_progress")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  return { onboarding: data, suggestedMentor: suggested, error: error?.message || null };
}

export async function saveMatchDecision(userId, { decision, mentorId, declinedIds = [] }) {
  const status =
    decision === "accepted" ? ONBOARDING_STATUS.ONBOARDING_COMPLETED : ONBOARDING_STATUS.MATCH_COMPLETED;

  const { data, error } = await getSupabase()
    .from("onboarding_progress")
    .upsert(
      {
        user_id: userId,
        match_decision: decision,
        onboarding_status: status,
        suggested_mentor_id: mentorId,
        declined_mentor_ids: declinedIds,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    )
    .select()
    .maybeSingle();

  if (error) return { error: error.message };

  if (decision === "accepted" && mentorId) {
    const mentor = getMentorById(mentorId);
    if (mentor) {
      await getSupabase().from("mentor_matches").delete().eq("user_id", userId).eq("status", "assigned");
      await getSupabase().from("mentor_matches").insert({
        user_id: userId,
        student_id: userId,
        mentor_name: mentor.name,
        mentor_email: null,
        mentor_college: mentor.school || mentor.university,
        mentor_major: mentor.major,
        expertise: mentor.tags || [],
        availability: mentor.availability,
        status: "assigned",
        notes: mentor.reason
      });
    }
  }

  return { onboarding: data, error: null };
}

export async function requestMentorMatch(userId, mentorId) {
  const mentor = getMentorById(mentorId);
  if (!mentor) return { error: "Mentor not found." };

  await getSupabase().from("mentor_matches").delete().eq("user_id", userId).eq("status", "saved");
  const { error } = await getSupabase().from("mentor_matches").insert({
    user_id: userId,
    student_id: userId,
    mentor_name: mentor.name,
    mentor_college: mentor.school || mentor.university,
    mentor_major: mentor.major,
    expertise: mentor.tags || [],
    availability: mentor.availability,
    status: "saved",
    notes: mentor.reason
  });

  return { error: error?.message || null };
}

export function mapOnboardingToUserFields(onboarding, hasAssignedMentor) {
  if (!onboarding) {
    return {
      matchOnboardingComplete: false,
      matchDecision: null,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_MATCH,
      suggestedMentorId: null,
      parentInviteStepComplete: false
    };
  }

  let status = onboarding.onboarding_status || ONBOARDING_STATUS.NEEDS_MATCH;
  if (hasAssignedMentor || onboarding.match_decision === "accepted") {
    status = ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  } else if (onboarding.mentor_matching_complete && !onboarding.match_decision) {
    status = ONBOARDING_STATUS.MATCH_COMPLETED;
  } else if (!onboarding.mentor_matching_complete) {
    status = ONBOARDING_STATUS.NEEDS_MATCH;
  }

  return {
    matchOnboardingComplete: Boolean(onboarding.mentor_matching_complete),
    matchDecision: onboarding.match_decision || null,
    onboardingStatus: status,
    suggestedMentorId: onboarding.suggested_mentor_id || null,
    questionnaireAnswers: onboarding.questionnaire_answers || {},
    parentInviteStepComplete: Boolean(onboarding.parent_invite_step_completed)
  };
}
