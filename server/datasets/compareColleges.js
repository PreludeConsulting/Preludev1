import { compareColleges } from "../rag/collegeComparison.js";
import { resolveCollegesFromText } from "./collegeAliases.js";
import { normalizeMajorTerm } from "./majorSynonyms.js";

export function compareCollegesFromQuery({ schools = "", major = "" } = {}) {
  const schoolList = String(schools)
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const resolved = [];
  const seen = new Set();
  for (const phrase of schoolList) {
    for (const school of resolveCollegesFromText(phrase)) {
      if (seen.has(school.unitid)) continue;
      seen.add(school.unitid);
      resolved.push(school);
    }
  }

  return compareColleges({
    schools: resolved,
    major: normalizeMajorTerm(major)
  });
}
