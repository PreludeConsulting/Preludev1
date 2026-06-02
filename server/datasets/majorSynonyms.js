const MAJOR_SYNONYMS = {
  cs: "computer science",
  "comp sci": "computer science",
  "comp-sci": "computer science",
  compsci: "computer science",
  "computer science": "computer science",
  "software engineering": "software engineering",
  swe: "software engineering",
  psych: "psychology",
  psychology: "psychology",
  bio: "biology",
  biology: "biology",
  engineering: "engineering",
  nursing: "nursing",
  business: "business",
  "data science": "data science"
};

export function normalizeMajorTerm(input = "") {
  const trimmed = String(input ?? "").trim().toLowerCase();
  if (!trimmed) return "";
  return MAJOR_SYNONYMS[trimmed] ?? trimmed;
}

export function expandMajorSearchPattern(majorTerm) {
  const normalized = normalizeMajorTerm(majorTerm);
  if (!normalized) return "";
  return normalized;
}
