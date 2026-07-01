import { getSupabase } from "./supabase.js";
import { filterMatchedMentors, finalizeMatchedMentors, MIN_MATCH_SCORE } from "../../shared/mentorSelectionLogic.js";

const EMPTY_ARRAY = [];

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

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function token(value) {
  return normalize(value).split(/\s+/)[0] || "";
}

function overlap(left = EMPTY_ARRAY, right = EMPTY_ARRAY) {
  const rightTerms = asArray(right).map(normalize);
  if (!rightTerms.length) return [];
  return asArray(left).filter((item) => {
    const itemText = normalize(item);
    const itemToken = token(item);
    return rightTerms.some((term) => term === itemText || term.includes(itemText) || itemText.includes(term) || term.includes(itemToken));
  });
}

function initialsFor(name) {
  return String(name || "Mentor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "M";
}

export function mapMentorMatchingProfile(row, matchPercent = null, reasons = []) {
  if (!row) return null;
  const specialties = Array.isArray(row.specialties) ? row.specialties : [];
  return {
    id: row.mentor_user_id,
    name: row.display_name || "Prelude mentor",
    school: row.college || "College mentor",
    university: row.college || "College mentor",
    major: row.major || "Admissions mentor",
    matchPercent: matchPercent ?? 88,
    tags: specialties.slice(0, 3),
    reason: reasons[0] || row.bio || "Strong fit based on your questionnaire.",
    availability: row.availability || "Availability shared after matching",
    initials: initialsFor(row.display_name),
    bestMatch: false,
    source: "supabase"
  };
}

export function extractMentorFields(answers = {}) {
  return {
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

export async function saveMentorQuestionnaire(user, answers) {
  if (!user?.id) return { error: "You must be signed in." };
  const fields = extractMentorFields(answers);
  const completed = Boolean(
    fields.college &&
      fields.major &&
      fields.bio &&
      fields.specialties.length &&
      fields.targetMajors.length &&
      fields.supportStyles.length &&
      fields.applicationStrengths.length &&
      fields.availability
  );

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
    display_name: user.name || user.email || "Prelude mentor",
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

  const [questionnaireRes, matchingRes] = await Promise.all([
    db()
      .from("mentor_questionnaires")
      .upsert(questionnairePayload, { onConflict: "user_id" })
      .select()
      .maybeSingle(),
    db()
      .from("mentor_matching_profiles")
      .upsert(matchingPayload, { onConflict: "mentor_user_id" })
      .select()
      .maybeSingle()
  ]);

  return {
    questionnaire: questionnaireRes.data || null,
    matchingProfile: matchingRes.data || null,
    completed,
    error: questionnaireRes.error?.message || matchingRes.error?.message || null
  };
}

export async function saveMentorProfileSettings(user, fields) {
  if (!user?.id) return { error: "You must be signed in." };

  const { questionnaire, matchingProfile, error } = await loadMentorQuestionnaire(user.id);
  if (error) return { error };

  const currentAnswers = questionnaire?.answers || {};
  const answers = {
    ...currentAnswers,
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

export function scoreMentorForStudent(studentAnswers = {}, mentorRow) {
  const studentHelp = asArray(studentAnswers.helpAreas || studentAnswers.accomplishFirst);
  const studentMajors = asArray(studentAnswers.academicInterests || studentAnswers.intendedMajor);
  const studentSchools = asArray(studentAnswers.colleges);
  const studentQualities = asArray(studentAnswers.mentorQualities);
  const structureScale = Number(studentAnswers.structureScale || 0);

  const reasons = [];
  let score = 50;

  const specialtyHits = overlap(studentHelp, mentorRow.specialties);
  if (specialtyHits.length) {
    score += Math.min(25, specialtyHits.length * 8);
    reasons.push(`Can help with ${specialtyHits.slice(0, 2).join(" and ")}.`);
  }

  const majorHits = overlap(studentMajors, mentorRow.target_majors);
  if (majorHits.length) {
    score += Math.min(20, majorHits.length * 7);
    reasons.push(`Relevant experience for ${majorHits.slice(0, 2).join(" and ")}.`);
  }

  const schoolHits = overlap(studentSchools, mentorRow.target_schools || [mentorRow.college]);
  if (schoolHits.length) {
    score += Math.min(18, schoolHits.length * 9);
    reasons.push(`Knows ${schoolHits.slice(0, 2).join(" and ")}.`);
  }

  const styleHits = overlap(studentQualities, mentorRow.support_styles);
  if (styleHits.length) {
    score += Math.min(14, styleHits.length * 5);
    reasons.push(`Matches your preferred support style.`);
  }

  const strengths = overlap([...studentHelp, ...studentQualities], mentorRow.application_strengths);
  if (strengths.length) {
    score += Math.min(12, strengths.length * 4);
  }

  if (structureScale >= 4 && overlap(["Structured step-by-step guidance"], mentorRow.support_styles).length) {
    score += 7;
  }
  if (structureScale > 0 && structureScale <= 2 && overlap(["Flexible and conversational"], mentorRow.support_styles).length) {
    score += 7;
  }
  if (mentorRow.completed) score += 8;
  if (mentorRow.availability) score += 3;

  return {
    score: Math.max(1, Math.min(99, Math.round(score))),
    reasons: reasons.length ? reasons : ["Strong overall fit based on your questionnaire."]
  };
}

export async function rankSupabaseMentorsForStudent(studentUserId, studentAnswers = {}, options = {}) {
  const minScore = options.minScore ?? MIN_MATCH_SCORE;
  const persistLimit = options.persistLimit ?? null;

  const { data, error } = await db()
    .from("mentor_matching_profiles")
    .select("*")
    .eq("completed", true);
  if (error) return { mentors: [], matchedMentors: [], error: error.message };

  const ranked = (data || [])
    .map((row) => {
      const { score, reasons } = scoreMentorForStudent(studentAnswers, row);
      return {
        row,
        score,
        reasons,
        mentor: mapMentorMatchingProfile(row, score, reasons)
      };
    })
    .sort((a, b) => b.score - a.score);

  const matched = finalizeMatchedMentors(ranked, minScore);
  const matchedIds = new Set(matched.map((mentor) => mentor.id));
  const matchedRanked = ranked.filter((item) => matchedIds.has(item.row.mentor_user_id));
  const toPersist = persistLimit ? matchedRanked.slice(0, persistLimit) : matchedRanked;

  if (studentUserId) {
    await db().from("mentor_match_scores").delete().eq("student_user_id", studentUserId);
    if (toPersist.length) {
      await db().from("mentor_match_scores").insert(
        toPersist.map((item) => ({
          student_user_id: studentUserId,
          mentor_user_id: item.row.mentor_user_id,
          score: item.score,
          reasons: item.reasons
        }))
      );
    }
  }

  return {
    mentors: matched,
    matchedMentors: matched,
    matchedMentorIds: matched.map((mentor) => mentor.id),
    matchedMentorCount: matched.length,
    error: null
  };
}

export async function getMentorMatchingProfile(mentorUserId) {
  if (!mentorUserId) return { mentor: null, error: null };
  const { data, error } = await db()
    .from("mentor_matching_profiles")
    .select("*")
    .eq("mentor_user_id", mentorUserId)
    .maybeSingle();
  return { mentor: data ? mapMentorMatchingProfile(data) : null, error: error?.message || null };
}
