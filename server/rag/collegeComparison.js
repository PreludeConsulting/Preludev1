import { lookupCollegeByAliasOrName, resolveCollegesFromText } from "../datasets/collegeAliases.js";
import { normalizeMajorTerm } from "../datasets/majorSynonyms.js";
import { COLLEGE_SCORECARD_SOURCE } from "../datasets/sources.js";
import { extractMajorTerms } from "./intent.js";

function formatCollegeRecord(college) {
  const parts = [
    college.name,
    [college.city, college.state].filter(Boolean).join(", "),
    college.averageNetPrice != null ? `avg net price $${college.averageNetPrice}` : null,
    college.admissionRate != null ? `admission rate ${(college.admissionRate * 100).toFixed(1)}%` : null,
    college.website ? `website ${college.website}` : null
  ].filter(Boolean);

  return {
    type: "college",
    id: college.unitid,
    summary: parts.join(" · "),
    source: college.source ?? COLLEGE_SCORECARD_SOURCE
  };
}

export function compareColleges({ schools = [], major = "" } = {}) {
  const normalizedMajor = normalizeMajorTerm(major);
  const resolvedSchools = [];

  for (const school of schools) {
    if (school.verifiedCollegeRecord) {
      resolvedSchools.push(school);
      continue;
    }
    const lookup = lookupCollegeByAliasOrName(school.aliasUsed ?? school.canonicalName ?? "");
    if (lookup.college) {
      resolvedSchools.push({
        canonicalName: lookup.canonicalName ?? lookup.college.name,
        aliasUsed: school.aliasUsed ?? lookup.originalPhrase,
        unitid: lookup.unitid,
        confidence: lookup.confidence,
        verifiedCollegeRecord: lookup.college
      });
    }
  }

  const records = resolvedSchools
    .map((school) => formatCollegeRecord(school.verifiedCollegeRecord))
    .filter(Boolean);

  return {
    intent: "college_comparison",
    major: normalizedMajor || null,
    schools: resolvedSchools,
    blocks:
      records.length > 0
        ? [{ heading: "Colleges requested for comparison", records }]
        : [],
    sources:
      records.length > 0
        ? [{ label: COLLEGE_SCORECARD_SOURCE, records }]
        : []
  };
}

export function buildComparisonFromText(text, conversationState = {}) {
  const fromText = resolveCollegesFromText(text);
  const fromState = conversationState.schoolsUnderDiscussion ?? [];
  const merged = new Map();

  for (const school of [...fromState, ...fromText]) {
    if (school?.unitid) merged.set(school.unitid, school);
  }

  const majors = extractMajorTerms(text);
  const major =
    normalizeMajorTerm(majors[0]) ||
    conversationState.intendedMajor ||
    (/\bcs\b/i.test(text) ? "computer science" : "");

  return compareColleges({
    schools: [...merged.values()],
    major
  });
}
