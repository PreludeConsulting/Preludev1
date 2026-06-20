import { getDatabase } from "../db/sqlite.js";
import { cleanText, parseOptionalNumber, parseOptionalRate } from "../db/values.js";
import { expandMajorSearchPattern } from "./majorSynonyms.js";
import { collegeSource } from "./sources.js";

const LIKERT_SCORE = {
  "Strongly disagree": 1,
  Disagree: 2,
  Neutral: 3,
  Agree: 4,
  "Strongly agree": 5
};

const QUESTION_INDEX = {
  grade: 0,
  gpaRange: 1,
  strongestSubject: 2,
  majorClarity: 5,
  collegeSize: 6,
  topRanked: 8,
  meritScholarship: 9,
  essaySupport: 11,
  research: 20,
  graduateSchool: 21,
  internshipReadiness: 22,
  stress: 23
};

function answerValue(questionnaire, index) {
  const answer = questionnaire?.answers?.find((item) => item.index === index)?.answer;
  return LIKERT_SCORE[answer] || 0;
}

function inferMajor(profile, questionnaire) {
  const majors = [
    ...(Array.isArray(profile?.targetMajors) ? profile.targetMajors : []),
    ...(Array.isArray(profile?.majors) ? profile.majors : [])
  ].filter(Boolean);
  if (majors.length) return majors[0];

  const subjectScore = answerValue(questionnaire, QUESTION_INDEX.strongestSubject);
  const researchScore = answerValue(questionnaire, QUESTION_INDEX.research);
  const internshipScore = answerValue(questionnaire, QUESTION_INDEX.internshipReadiness);
  if (researchScore >= 4 || subjectScore >= 4 || internshipScore >= 4) return "computer science";
  return "";
}

function inferState(profile) {
  const location = `${profile?.location || ""} ${profile?.highSchool || ""}`.toUpperCase();
  const stateMatch = location.match(/\b[A-Z]{2}\b/);
  return stateMatch?.[0] || "";
}

function inferPreferences(profile, questionnaire) {
  const major = inferMajor(profile, questionnaire);
  const meritScholarship = answerValue(questionnaire, QUESTION_INDEX.meritScholarship);
  const topRanked = answerValue(questionnaire, QUESTION_INDEX.topRanked);
  const research = answerValue(questionnaire, QUESTION_INDEX.research);
  const internshipReadiness = answerValue(questionnaire, QUESTION_INDEX.internshipReadiness);
  const stress = answerValue(questionnaire, QUESTION_INDEX.stress);
  const size = answerValue(questionnaire, QUESTION_INDEX.collegeSize);

  return {
    major,
    state: inferState(profile),
    maxNetPrice: meritScholarship >= 4 ? 30000 : "",
    prefersSelective: topRanked >= 4,
    prefersValue: meritScholarship >= 4,
    prefersResearch: research >= 4 || internshipReadiness >= 4,
    needsBalancedList: stress >= 4,
    sizePreference: size >= 4 ? "large" : size > 0 && size <= 2 ? "small" : ""
  };
}

function majorSearchParts(major) {
  const normalized = String(major || "").toLowerCase().trim();
  if (!normalized) return [];
  if (normalized === "electrical engineering") return ["electrical", "engineering"];
  if (normalized === "chemical engineering") return ["chemical", "engineering"];
  if (normalized === "mechanical engineering") return ["mechanical", "engineering"];
  if (normalized === "civil engineering") return ["civil", "engineering"];
  if (normalized === "aerospace engineering") return ["aerospace", "engineering"];
  if (normalized === "computer engineering") return ["computer", "engineering"];
  return [expandMajorSearchPattern(normalized)];
}

function formatCollegeRow(row) {
  return {
    unitid: cleanText(row.unitid),
    id: cleanText(row.unitid),
    name: cleanText(row.name),
    city: cleanText(row.city),
    state: cleanText(row.state),
    website: cleanText(row.website),
    admissionRate: parseOptionalRate(row.admission_rate),
    satAverage: parseOptionalNumber(row.sat_average),
    undergradSize: parseOptionalNumber(row.undergrad_size),
    tuitionInState: parseOptionalNumber(row.tuition_in_state),
    tuitionOutOfState: parseOptionalNumber(row.tuition_out_of_state),
    averageNetPrice: parseOptionalNumber(row.average_net_price),
    completionRate4yr: parseOptionalRate(row.completion_rate_4yr),
    retentionRate: parseOptionalRate(row.retention_rate_full_time),
    medianEarnings10yr: parseOptionalNumber(row.median_earnings_10yr),
    source: collegeSource(row)
  };
}

function addReason(reasons, condition, label) {
  if (condition) reasons.push(label);
}

function classifyMatch(college, score) {
  if (college.admissionRate != null) {
    if (college.admissionRate <= 0.2) return "Reach";
    if (college.admissionRate <= 0.55) return "Target";
    return "Likely";
  }
  if (score >= 80) return "Strong fit";
  if (score >= 65) return "Good fit";
  return "Explore";
}

function describeCollegeFit(college, preferences, reasons) {
  if (/Massachusetts Institute of Technology|MIT/i.test(college.name) && /aerospace|engineering/i.test(preferences.major || "")) {
    return "MIT is worth reviewing because its engineering ecosystem is one of the strongest in the world, including aerospace-adjacent research and project opportunities.";
  }
  if (preferences.major) {
    return `${college.name} may fit because it has programs related to ${preferences.major} and ${reasons[0]?.toLowerCase() || "matches several parts of your profile"}`;
  }
  if (reasons.length) {
    return `${college.name} may fit because ${reasons[0].toLowerCase()}`;
  }
  return `${college.name} is a starting recommendation based on verified outcomes and available college data.`;
}

function scoreCollege(college, preferences) {
  const reasons = [];
  let score = 50;

  if (preferences.prefersSelective && college.admissionRate != null) {
    if (college.admissionRate <= 0.25) {
      score += 18;
      reasons.push("Matches your interest in highly ranked or selective schools.");
    } else if (college.admissionRate <= 0.55) {
      score += 8;
    }
  }

  if (preferences.prefersValue && college.averageNetPrice != null) {
    if (college.averageNetPrice <= 20000) {
      score += 18;
      reasons.push("Strong affordability signal based on average net price.");
    } else if (college.averageNetPrice <= 30000) {
      score += 10;
      reasons.push("Moderate net price fit for scholarship-conscious planning.");
    }
  }

  if (preferences.prefersResearch && college.completionRate4yr != null && college.completionRate4yr >= 0.7) {
    score += 10;
    reasons.push("Strong completion outcomes for students planning research, internships, or graduate school.");
  }

  if (preferences.sizePreference === "large" && college.undergradSize >= 15000) {
    score += 8;
    reasons.push("Larger undergraduate community fit.");
  }
  if (preferences.sizePreference === "small" && college.undergradSize > 0 && college.undergradSize <= 8000) {
    score += 8;
    reasons.push("Smaller undergraduate community fit.");
  }

  if (preferences.state && college.state === preferences.state) {
    score += 6;
    reasons.push("In-state or nearby option based on your profile.");
  }

  addReason(reasons, preferences.major, `Includes programs related to ${preferences.major}.`);
  addReason(reasons, preferences.needsBalancedList, "Helps build a balanced list while admissions stress is high.");

  return {
    ...college,
    score: Math.max(0, Math.min(100, Math.round(score))),
    matchCategory: classifyMatch(college, score),
    description: describeCollegeFit(college, preferences, reasons),
    reasons: reasons.slice(0, 4)
  };
}

export function recommendCollegesFromQuestionnaire({ profile = null, questionnaire = null, limit = 8 } = {}) {
  const preferences = inferPreferences(profile, questionnaire);
  const db = getDatabase();
  const params = [];
  const conditions = [];
  const majorParts = majorSearchParts(preferences.major);

  if (majorParts.length) {
    conditions.push(`(${majorParts.map(() => "LOWER(f.cip_description) LIKE LOWER(?)").join(" AND ")})`);
    params.push(...majorParts.map((part) => `%${part.replace(/[%_]/g, "")}%`));
  }
  if (preferences.state) {
    conditions.push("c.state = ?");
    params.push(preferences.state);
  }
  if (preferences.maxNetPrice) {
    conditions.push("c.average_net_price IS NOT NULL AND c.average_net_price NOT IN ('', 'NA') AND CAST(c.average_net_price AS REAL) <= ?");
    params.push(preferences.maxNetPrice);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const joinClause = majorParts.length ? "INNER JOIN fields_of_study f ON f.unitid = c.unitid" : "";
  const distinct = majorParts.length ? "DISTINCT" : "";
  const rows = db.prepare(`
    SELECT ${distinct}
      c.unitid, c.name, c.city, c.state, c.website,
      c.admission_rate, c.sat_average, c.undergrad_size,
      c.tuition_in_state, c.tuition_out_of_state, c.average_net_price,
      c.completion_rate_4yr, c.retention_rate_full_time,
      c.median_earnings_10yr, c.source
    FROM colleges c
    ${joinClause}
    ${whereClause}
    ORDER BY
      CASE WHEN c.completion_rate_4yr IS NULL OR c.completion_rate_4yr IN ('', 'NA') THEN 1 ELSE 0 END,
      CAST(c.completion_rate_4yr AS REAL) DESC,
      CASE WHEN c.average_net_price IS NULL OR c.average_net_price IN ('', 'NA') THEN 1 ELSE 0 END,
      CAST(c.average_net_price AS REAL) ASC,
      c.name ASC
    LIMIT 50
  `).all(...params);

  const baseRows = rows.length ? rows : db.prepare(`
    SELECT unitid, name, city, state, website, admission_rate, sat_average, undergrad_size,
           tuition_in_state, tuition_out_of_state, average_net_price, completion_rate_4yr,
           retention_rate_full_time, median_earnings_10yr, source
    FROM colleges
    WHERE completion_rate_4yr IS NOT NULL AND completion_rate_4yr NOT IN ('', 'NA')
    ORDER BY CAST(completion_rate_4yr AS REAL) DESC, name ASC
    LIMIT 50
  `).all();

  return {
    preferences,
    questionnaireRequired: !questionnaire,
    recommendations: baseRows
      .map(formatCollegeRow)
      .map((college) => scoreCollege(college, preferences))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit)
  };
}
