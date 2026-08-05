import { getSupabase } from "./supabase.js";
import {
  fetchAndRankMentorsForStudent,
  isEligibleMentorProfile,
  mapMentorMatchingProfile,
  scoreMentorForStudent
} from "../../shared/mentorMatching.js";

export { isEligibleMentorProfile, mapMentorMatchingProfile, scoreMentorForStudent };

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function extractMentorFields(answers = {}) {
  return {
    fullName: (answers.fullName || "").trim(),
    avatarUrl: (answers.avatarUrl || "").trim(),
    college: (answers.college || "").trim(),
    major: (answers.major || "").trim(),
    bio: (answers.bio || "").trim(),
    specialties: asArray(answers.specialties),
    targetMajors: asArray(answers.targetMajors),
    targetSchools: asArray(answers.targetSchools),
    supportStyles: asArray(answers.supportStyles),
    applicationStrengths: asArray(answers.applicationStrengths),
    availability: (answers.availability || "").trim()
  };
}

export async function loadMentorQuestionnaire(userId) {
  if (!userId) return { questionnaire: null, matchingProfile: null, error: "You must be signed in." };
  const [questionnaireRes, profileRes] = await Promise.all([
    db().from("mentor_questionnaires").select("*").eq("user_id", userId).maybeSingle(),
    db().from("mentor_matching_profiles").select("*").eq("mentor_user_id", userId).maybeSingle()
  ]);
  return {
    questionnaire: questionnaireRes.data || null,
    matchingProfile: profileRes.data || null,
    error: questionnaireRes.error?.message || profileRes.error?.message || null
  };
}

export async function saveMentorQuestionnaire(user, answers, options = {}) {
  if (!user?.id) return { error: "You must be signed in." };
  const fields = extractMentorFields(answers);
  const meetsRequirements = Boolean(
    fields.fullName &&
      fields.avatarUrl &&
      fields.college &&
      fields.major &&
      fields.bio &&
      fields.specialties.length &&
      fields.targetMajors.length &&
      fields.supportStyles.length &&
      fields.applicationStrengths.length &&
      fields.availability
  );
  const completed = options.markComplete === false ? false : meetsRequirements;

  const now = new Date().toISOString();
  const questionnairePayload = {
    user_id: user.id,
    answers,
    completed,
    submitted_at: completed ? now : null,
    updated_at: now
  };

  const matchingPayload = {
    mentor_user_id: user.id,
    display_name: fields.fullName || user.name || user.email || "Prelude mentor",
    avatar_url: fields.avatarUrl || null,
    college: fields.college,
    major: fields.major,
    bio: fields.bio,
    specialties: fields.specialties,
    target_majors: fields.targetMajors,
    target_schools: fields.targetSchools,
    support_styles: fields.supportStyles,
    application_strengths: fields.applicationStrengths,
    availability: fields.availability,
    completed,
    updated_at: now
  };

  const [questionnaireRes, matchingRes, profileRes] = await Promise.all([
    db()
      .from("mentor_questionnaires")
      .upsert(questionnairePayload, { onConflict: "user_id" })
      .select()
      .maybeSingle(),
    db()
      .from("mentor_matching_profiles")
      .upsert(matchingPayload, { onConflict: "mentor_user_id" })
      .select()
      .maybeSingle(),
    db()
      .from("profiles")
      .update({
        full_name: fields.fullName,
        avatar_url: fields.avatarUrl || null,
        updated_at: now
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle()
  ]);

  return {
    questionnaire: questionnaireRes.data || null,
    matchingProfile: matchingRes.data || null,
    completed,
    error:
      questionnaireRes.error?.message ||
      matchingRes.error?.message ||
      profileRes.error?.message ||
      null
  };
}

export async function saveMentorProfileSettings(user, fields) {
  if (!user?.id) return { error: "You must be signed in." };

  const { questionnaire, matchingProfile, error } = await loadMentorQuestionnaire(user.id);
  if (error) return { error };

  const currentAnswers = questionnaire?.answers || {};
  const answers = {
    ...currentAnswers,
    fullName: fields.fullName ?? currentAnswers.fullName ?? matchingProfile?.display_name ?? user.name ?? "",
    avatarUrl: fields.avatarUrl ?? currentAnswers.avatarUrl ?? matchingProfile?.avatar_url ?? user.avatarUrl ?? "",
    college: fields.college ?? currentAnswers.college ?? matchingProfile?.college ?? "",
    major: fields.major ?? currentAnswers.major ?? matchingProfile?.major ?? "",
    bio: fields.bio ?? currentAnswers.bio ?? matchingProfile?.bio ?? "",
    specialties: fields.specialties ?? currentAnswers.specialties ?? matchingProfile?.specialties ?? [],
    targetMajors: fields.targetMajors ?? currentAnswers.targetMajors ?? matchingProfile?.target_majors ?? [],
    targetSchools: fields.targetSchools ?? currentAnswers.targetSchools ?? matchingProfile?.target_schools ?? [],
    supportStyles: fields.supportStyles ?? currentAnswers.supportStyles ?? matchingProfile?.support_styles ?? [],
    applicationStrengths:
      fields.applicationStrengths ??
      currentAnswers.applicationStrengths ??
      matchingProfile?.application_strengths ??
      [],
    availability: fields.availability ?? currentAnswers.availability ?? matchingProfile?.availability ?? "",
    additionalNotes: fields.additionalNotes ?? currentAnswers.additionalNotes ?? ""
  };

  return saveMentorQuestionnaire(user, answers);
}

export async function rankSupabaseMentorsForStudent(studentUserId, studentAnswers = {}, options = {}) {
  return fetchAndRankMentorsForStudent(db(), studentUserId, studentAnswers, options);
}

export async function getMentorMatchingProfile(mentorUserId) {
  if (!mentorUserId) return { mentor: null, error: null };
  const { data, error } = await db()
    .from("mentor_matching_profiles")
    .select(
      "mentor_user_id,display_name,avatar_url,college,major,bio,specialties,target_majors,target_schools,support_styles,application_strengths,availability,completed,approved,updated_at"
    )
    .eq("mentor_user_id", mentorUserId)
    .maybeSingle();
  return { mentor: data ? mapMentorMatchingProfile(data) : null, error: error?.message || null };
}

/** Approved, completed mentor accounts shown in the student-facing network. */
export async function listMentorNetworkProfiles() {
  const { data, error } = await db()
    .from("mentor_matching_profiles")
    .select("*")
    .eq("completed", true)
    .eq("approved", true)
    .order("updated_at", { ascending: false });
  return {
    mentors: (data || []).map((row) => mapMentorMatchingProfile(row)),
    error: error?.message || null
  };
}

export function subscribeMentorNetworkProfiles(onChange) {
  const client = db();
  const channel = client
    .channel(`mentor-network-${Math.random().toString(36).slice(2, 10)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "mentor_matching_profiles" },
      () => onChange?.()
    )
    .subscribe();
  return () => client.removeChannel(channel);
}
