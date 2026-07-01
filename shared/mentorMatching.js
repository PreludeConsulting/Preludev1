import { finalizeMatchedMentors, MIN_MATCH_SCORE } from "./mentorSelectionLogic.js";

const EMPTY_ARRAY = [];

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
    return rightTerms.some(
      (term) => term === itemText || term.includes(itemText) || itemText.includes(term) || term.includes(itemToken)
    );
  });
}

function initialsFor(name) {
  return (
    String(name || "Mentor")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M"
  );
}

export function isEligibleMentorProfile(row) {
  if (!row?.mentor_user_id) return false;
  if (row.completed) return true;
  return Boolean(row.display_name?.trim() && row.college?.trim() && row.major?.trim());
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
    reasons.push("Matches your preferred support style.");
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

export function rankMentorRowsForStudent(studentAnswers = {}, rows = [], options = {}) {
  const minScore = options.minScore ?? MIN_MATCH_SCORE;
  const ranked = rows
    .filter(isEligibleMentorProfile)
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

  return {
    ranked,
    matched,
    matchedRanked,
    matchedMentorIds: matched.map((mentor) => mentor.id),
    matchedMentorCount: matched.length
  };
}

export async function fetchAndRankMentorsForStudent(supabase, studentUserId, studentAnswers = {}, options = {}) {
  const persistLimit = options.persistLimit ?? null;
  const { data, error } = await supabase.from("mentor_matching_profiles").select("*");
  if (error) {
    return { mentors: [], matchedMentors: [], matchedMentorIds: [], matchedMentorCount: 0, error: error.message };
  }

  const result = rankMentorRowsForStudent(studentAnswers, data || [], options);
  const toPersist = persistLimit ? result.matchedRanked.slice(0, persistLimit) : result.matchedRanked;

  if (studentUserId) {
    await supabase.from("mentor_match_scores").delete().eq("student_user_id", studentUserId);
    if (toPersist.length) {
      await supabase.from("mentor_match_scores").insert(
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
    mentors: result.matched,
    matchedMentors: result.matched,
    matchedMentorIds: result.matchedMentorIds,
    matchedMentorCount: result.matchedMentorCount,
    error: null
  };
}
