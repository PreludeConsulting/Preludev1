import { extractState, extractMajorTerms } from "./intent.js";
import { lookupUniversityInText, lookupUniversityByName, lookupUniversitiesInText } from "./universityLookup.js";
import { similarityScore } from "./fuzzyMatch.js";

const MAJOR_ALIASES = {
  cs: "computer science",
  "comp sci": "computer science",
  "comp science": "computer science",
  business: "business",
  bio: "biology",
  "pre med": "pre-med",
  premed: "pre-med",
  econ: "economics",
  engineering: "engineering"
};

export function extractScores(text) {
  const raw = String(text ?? "");
  const sat = raw.match(/\b(?:sat|psat)[^0-9]{0,12}(\d{3,4})\b/i) || raw.match(/\b(\d{3,4})\s+sat\b/i);
  const act = raw.match(/\bact[^0-9]{0,12}(\d{1,2})\b/i) || raw.match(/\b(\d{1,2})\s+act\b/i);
  const gpa = raw.match(/\bgpa[^0-9]{0,8}(\d(?:\.\d{1,2})?)\b/i) || raw.match(/\b(\d\.\d{1,2})\s+gpa\b/i);

  return {
    sat: sat ? Number(sat[1]) : null,
    act: act ? Number(act[1]) : null,
    gpa: gpa ? Number(gpa[1]) : null
  };
}

export function extractMajors(text) {
  const majors = extractMajorTerms(text);
  const lower = String(text ?? "").toLowerCase();
  for (const [alias, major] of Object.entries(MAJOR_ALIASES)) {
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) {
      majors.push(major);
    }
  }
  return [...new Set(majors)];
}

export function extractInterests(text) {
  const interests = [];
  const lower = String(text ?? "").toLowerCase();
  if (/\b(stem|science|engineering|math)\b/.test(lower)) interests.push("STEM");
  if (/\b(business|finance|entrepreneurship)\b/.test(lower)) interests.push("business");
  if (/\b(biology|biolog)\b/.test(lower)) interests.push("biology");
  if (/\b(biology|pre-med|medicine|med)\b/.test(lower)) interests.push("biology/pre-med");
  if (/\b(cs|computer science|coding|software)\b/.test(lower)) interests.push("computer science");
  if (/\b(arts?|music|theater|creative writing)\b/.test(lower)) interests.push("arts");
  return [...new Set(interests)];
}

export function extractEntities(message, memory = {}) {
  const text = String(message ?? "");
  const schools = lookupUniversitiesInText(text);
  const school = schools[0] ?? memory.lastSchool ?? null;
  const scores = extractScores(text);
  const majors = extractMajors(text);
  const interests = extractInterests(text);
  const state = extractState(text) || memory.state || null;
  const budgetMatch = text.match(/\$?\s?(\d{2,3}),?(\d{3})\b/);

  return {
    schools,
    school,
    majors: majors.length ? majors : memory.majors ?? [],
    interests: interests.length ? interests : memory.interests ?? [],
    state,
    budget: budgetMatch ? Number(`${budgetMatch[1]}${budgetMatch[2]}`) : memory.budget ?? null,
    sat: scores.sat ?? memory.sat ?? null,
    act: scores.act ?? memory.act ?? null,
    gpa: scores.gpa ?? memory.gpa ?? null,
    gradeLevel: memory.gradeLevel ?? null
  };
}

export function describeEntityMatch(school) {
  if (!school) return null;
  if (school.matchConfidence === "medium" && school.matchedAlias) {
    return `I think you mean **${school.metadata.name}**.`;
  }
  if (school.matchConfidence === "medium") {
    return `I think you mean **${school.metadata.name}**.`;
  }
  return null;
}

export function fuzzyResolveSchoolName(token) {
  const direct = lookupUniversityByName(token);
  if (direct) return direct;

  const fromText = lookupUniversityInText(token);
  if (fromText) return fromText;

  const normalized = String(token ?? "").toLowerCase().trim();
  if (normalized.length < 4) return null;

  const candidates = ["harvard university", "brown university", "georgia institute of technology", "university of pennsylvania"];
  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = similarityScore(normalized, candidate.split(" ")[0]);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (bestScore >= 0.75) return lookupUniversityByName(best);
  return null;
}
