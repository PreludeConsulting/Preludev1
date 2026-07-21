import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../../scripts/lib/csvParse.js";
import { dashboardDataDir } from "../../scripts/lib/knowledgeIngest.js";
import { similarityScore } from "./fuzzyMatch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNIVERSITY_CSV = path.join(dashboardDataDir, "university_database.csv");

const ALIAS_ENTRIES = [
  { aliases: ["harvard", "harvard university", "havard", "havards", "harverd", "harvards", "harvardd"], name: "Harvard University" },
  { aliases: ["brown", "brown university"], name: "Brown University" },
  { aliases: ["upenn", "u penn", "penn", "upen", "university of pennsylvania"], name: "University of Pennsylvania" },
  { aliases: ["uga", "university of georgia"], name: "University of Georgia" },
  { aliases: ["gt", "georgia tech", "gatech", "georiga tech", "georgia institute of technology"], name: "Georgia Institute of Technology-Main Campus" },
  { aliases: ["mit", "massachusetts institute of technology"], name: "Massachusetts Institute of Technology" },
  { aliases: ["caltech", "california institute of technology"], name: "California Institute of Technology" },
  { aliases: ["berkeley", "uc berkeley", "university of california berkeley", "university of california-berkeley"], name: "University of California-Berkeley" },
  { aliases: ["stanford", "stanford university"], name: "Stanford University" },
  { aliases: ["yale", "yale university"], name: "Yale University" },
  { aliases: ["princeton", "princeton university"], name: "Princeton University" },
  { aliases: ["columbia", "columbia university"], name: "Columbia University in the City of New York" },
  { aliases: ["ucla", "university of california los angeles"], name: "University of California-Los Angeles" },
  { aliases: ["usc", "university of southern california"], name: "University of Southern California" },
  { aliases: ["nyu", "new york university"], name: "New York University" },
  { aliases: ["duke", "duke university"], name: "Duke University" },
  { aliases: ["northwestern", "northwestern university"], name: "Northwestern University" },
  { aliases: ["cornell", "cornell university"], name: "Cornell University" },
  { aliases: ["auburn", "auburn university"], name: "Auburn University" }
];

let universityIndex = null;
const aliasLookup = new Map();

const GENERIC_NAME_TOKENS = new Set([
  "a",
  "an",
  "and",
  "at",
  "campus",
  "campuses",
  "college",
  "colleges",
  "community",
  "for",
  "in",
  "institute",
  "institution",
  "main",
  "of",
  "on",
  "school",
  "schools",
  "the",
  "tech",
  "technology",
  "universities",
  "university"
]);
const FUZZY_THRESHOLD = 0.88;
const FUZZY_RUNNER_UP_MARGIN = 0.08;
const MAX_FUZZY_NAME_TOKENS = 16;

for (const entry of ALIAS_ENTRIES) {
  for (const alias of entry.aliases) {
    const key = normalizeKey(alias);
    const targets = aliasLookup.get(key) ?? new Set();
    targets.add(entry.name);
    aliasLookup.set(key, targets);
  }
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (value == null || value === "" || String(value).toUpperCase() === "NA") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toUniversityRecord(row) {
  return {
    id: `dash_univ_${row.UNITID}`,
    sourceType: "university",
    title: row.INSTNM,
    source: "Prelude University Database",
    metadata: {
      unitid: row.UNITID,
      name: row.INSTNM,
      city: row.CITY || null,
      state: row.STABBR || null,
      zip: row.ZIP || null,
      website: row.INSTURL || null,
      admissionRate: parseNumber(row.ADM_RATE),
      satAverage: parseNumber(row.SAT_AVG),
      totalCost: parseNumber(row.COSTT4_A),
      tuitionInState: parseNumber(row.TUITIONFEE_IN),
      tuitionOutOfState: parseNumber(row.TUITIONFEE_OUT)
    }
  };
}

function meaningfulTokens(value, { fuzzyGeneric = false } = {}) {
  return normalizeKey(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => {
      if (GENERIC_NAME_TOKENS.has(token)) return false;
      if (!fuzzyGeneric) return true;
      return ![...GENERIC_NAME_TOKENS].some(
        (generic) => generic.length >= 4 && similarityScore(token, generic) >= FUZZY_THRESHOLD
      );
    });
}

function isSearchablePhrase(value) {
  return meaningfulTokens(value).length > 0;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasePattern(value) {
  return new RegExp(`(?:^|\\s)(${escapeRegExp(value)})(?=$|\\s)`, "gi");
}

function buildSearchEntries(byName) {
  const aliases = [];
  for (const [alias, targetNames] of aliasLookup.entries()) {
    if (!isSearchablePhrase(alias) || targetNames.size !== 1) continue;
    const [targetName] = targetNames;
    const records = byName.get(normalizeKey(targetName)) ?? [];
    if (records.length !== 1) continue;
    aliases.push({
      phrase: alias,
      pattern: phrasePattern(alias),
      record: records[0],
      method: "exact_alias"
    });
  }

  const canonical = [];
  for (const [name, records] of byName.entries()) {
    if (!isSearchablePhrase(name) || records.length !== 1) continue;
    canonical.push({
      phrase: name,
      pattern: phrasePattern(name),
      record: records[0],
      method: "exact_canonical"
    });
  }

  const fuzzy = [];
  const addFuzzyCandidate = (value, record, method) => {
    const normalized = normalizeKey(value);
    const rawTokens = normalized.split(" ").filter(Boolean);
    const significant = meaningfulTokens(normalized);
    if (
      rawTokens.length < 2 ||
      rawTokens.length > MAX_FUZZY_NAME_TOKENS ||
      significant.length < 2
    ) {
      return;
    }
    fuzzy.push({ normalized, rawTokens, significant, record, method });
  };

  for (const item of aliases) addFuzzyCandidate(item.phrase, item.record, "fuzzy_alias");
  for (const item of canonical) addFuzzyCandidate(item.phrase, item.record, "fuzzy_canonical");
  return { aliases, canonical, fuzzy };
}

function loadUniversityIndex() {
  if (universityIndex) return universityIndex;

  const csv = fs.readFileSync(UNIVERSITY_CSV, "utf8");
  const rows = parseCsv(csv).filter((row) => row.INSTNM);
  const byName = new Map();
  const all = [];

  for (const row of rows) {
    const record = toUniversityRecord(row);
    all.push(record);
    const name = normalizeKey(record.title);
    const records = byName.get(name) ?? [];
    records.push(record);
    byName.set(name, records);
  }

  universityIndex = { all, byName };
  universityIndex.search = buildSearchEntries(byName);
  return universityIndex;
}

function annotateMatch(record, { method, score, confidence, matchedAlias } = {}) {
  return {
    ...record,
    matchMethod: method,
    matchScore: score,
    matchConfidence: confidence,
    ...(matchedAlias ? { matchedAlias } : {})
  };
}

function getUniqueRecordByName(index, name) {
  const records = index.byName.get(normalizeKey(name)) ?? [];
  return records.length === 1 ? records[0] : null;
}

function tokenLevelScore(queryTokens, candidateTokens) {
  if (queryTokens.length !== candidateTokens.length || candidateTokens.length < 2) return 0;
  let total = 0;
  for (let index = 0; index < candidateTokens.length; index += 1) {
    const score = similarityScore(queryTokens[index], candidateTokens[index]);
    if (score < FUZZY_THRESHOLD) return 0;
    total += score;
  }
  return total / candidateTokens.length;
}

function fuzzyStandaloneLookup(normalized, index) {
  const rawTokens = normalized.split(" ").filter(Boolean);
  if (rawTokens.length < 2 || rawTokens.length > MAX_FUZZY_NAME_TOKENS) return null;
  const queryTokens = meaningfulTokens(normalized, { fuzzyGeneric: true });
  if (queryTokens.length < 2) return null;

  const bestByRecord = new Map();
  for (const candidate of index.search.fuzzy) {
    if (candidate.rawTokens.length !== rawTokens.length) continue;
    const score = tokenLevelScore(queryTokens, candidate.significant);
    if (score < FUZZY_THRESHOLD) continue;
    const prior = bestByRecord.get(candidate.record.id);
    if (!prior || score > prior.score) {
      bestByRecord.set(candidate.record.id, { ...candidate, score });
    }
  }

  const ranked = [...bestByRecord.values()].sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best) return null;
  const runnerUp = ranked[1];
  if (runnerUp && best.score - runnerUp.score < FUZZY_RUNNER_UP_MARGIN) return null;

  return annotateMatch(best.record, {
    method: best.method,
    score: best.score,
    confidence: "medium",
    matchedAlias: normalized
  });
}

function exactMatchesInText(normalized, index) {
  const found = new Map();
  const entries = [...index.search.aliases, ...index.search.canonical];

  for (const entry of entries) {
    entry.pattern.lastIndex = 0;
    let match;
    while ((match = entry.pattern.exec(normalized))) {
      const position = match.index + match[0].length - match[1].length;
      const prior = found.get(entry.record.id);
      if (
        !prior ||
        position < prior.position ||
        (position === prior.position && entry.phrase.length > prior.phrase.length)
      ) {
        found.set(entry.record.id, { ...entry, position });
      }
      if (!entry.pattern.global) break;
    }
  }

  return [...found.values()]
    .sort((left, right) => left.position - right.position)
    .map((match) =>
      annotateMatch(match.record, {
        method: match.method,
        score: 1,
        confidence: "high",
        ...(match.method === "exact_alias" ? { matchedAlias: match.phrase } : {})
      })
    );
}

export function lookupUniversityByName(name) {
  if (!name) return null;
  const index = loadUniversityIndex();
  const normalized = normalizeKey(name);
  if (!normalized) return null;

  const aliasTargets = aliasLookup.get(normalized);
  if (aliasTargets?.size === 1) {
    const [targetName] = aliasTargets;
    const record = getUniqueRecordByName(index, targetName);
    if (record) {
      return annotateMatch(record, {
        method: "exact_alias",
        score: 1,
        confidence: "high",
        matchedAlias: name
      });
    }
  }

  const exact = getUniqueRecordByName(index, normalized);
  if (exact) {
    return annotateMatch(exact, { method: "exact_canonical", score: 1, confidence: "high" });
  }

  return fuzzyStandaloneLookup(normalized, index);
}

export function lookupUniversitiesInText(text) {
  const raw = stripPossessives(String(text ?? "").trim());
  if (!raw) return [];
  const index = loadUniversityIndex();
  const normalized = normalizeKey(raw);
  const exact = exactMatchesInText(normalized, index);
  return exact.slice(0, 4);
}

function stripPossessives(text) {
  return String(text ?? "").replace(/\b([a-z0-9]+)'s\b/gi, "$1");
}

export function lookupUniversityInText(text) {
  const raw = stripPossessives(String(text ?? "").trim());
  if (!raw) return null;

  const normalized = normalizeKey(raw);
  const index = loadUniversityIndex();
  const exact = exactMatchesInText(normalized, index);
  if (exact.length) return exact[0];
  return null;
}

export function listUniversities() {
  return loadUniversityIndex().all;
}
