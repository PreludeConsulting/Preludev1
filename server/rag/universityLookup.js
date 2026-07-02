import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../../scripts/lib/csvParse.js";
import { dashboardDataDir } from "../../scripts/lib/knowledgeIngest.js";
import { similarityScore, findBestFuzzyMatch } from "./fuzzyMatch.js";

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

for (const entry of ALIAS_ENTRIES) {
  for (const alias of entry.aliases) {
    aliasLookup.set(normalizeKey(alias), entry.name);
  }
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
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

function loadUniversityIndex() {
  if (universityIndex) return universityIndex;

  const csv = fs.readFileSync(UNIVERSITY_CSV, "utf8");
  const rows = parseCsv(csv).filter((row) => row.INSTNM);
  const byName = new Map();
  const all = [];

  for (const row of rows) {
    const record = toUniversityRecord(row);
    all.push(record);
    byName.set(normalizeKey(record.title), record);
  }

  universityIndex = { all, byName };
  return universityIndex;
}

function scoreNameMatch(query, recordName) {
  const q = normalizeKey(query);
  const name = normalizeKey(recordName);
  if (!q || !name) return 0;
  if (q === name) return 100;
  if (name.includes(q) || q.includes(name)) return 80;
  if (name.startsWith(q) || q.startsWith(name)) return 70;

  const qTokens = q.split(" ").filter((token) => token.length >= 3);
  const nameTokens = new Set(name.split(" ").filter((token) => token.length >= 3));
  let overlap = 0;
  for (const token of qTokens) {
    if (nameTokens.has(token)) overlap += 1;
  }
  return overlap * 15;
}

function fuzzyAliasLookup(query) {
  const normalized = normalizeKey(query);
  if (aliasLookup.has(normalized)) {
    return { name: aliasLookup.get(normalized), confidence: "high" };
  }

  const candidates = [...aliasLookup.keys()];
  const match = findBestFuzzyMatch(normalized, candidates, { threshold: 0.82, minLength: 4 });
  if (match) {
    return { name: aliasLookup.get(match.value), confidence: match.confidence };
  }
  return null;
}

export function lookupUniversityByName(name) {
  if (!name) return null;
  const index = loadUniversityIndex();
  const normalized = normalizeKey(name);
  const fuzzyAlias = fuzzyAliasLookup(name);
  if (fuzzyAlias?.name) {
    const exact = index.byName.get(normalizeKey(fuzzyAlias.name));
    if (exact) {
      return {
        ...exact,
        matchConfidence: fuzzyAlias.confidence,
        matchedAlias: name
      };
    }
  }

  const aliasTarget = aliasLookup.get(normalized);
  if (aliasTarget) {
    const exact = index.byName.get(normalizeKey(aliasTarget));
    if (exact) return { ...exact, matchConfidence: "high", matchedAlias: name };
  }

  const exact = index.byName.get(normalized);
  if (exact) return { ...exact, matchConfidence: "high" };

  let best = null;
  let bestScore = 0;
  for (const record of index.all) {
    const score = scoreNameMatch(name, record.title);
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }

  if (!best || bestScore < 30) {
    const fuzzy = findBestFuzzyMatch(
      normalized,
      index.all.map((record) => record.title),
      { threshold: 0.78, minLength: 5 }
    );
    if (fuzzy) {
      const record = index.byName.get(normalizeKey(fuzzy.value));
      if (record) {
        return { ...record, matchConfidence: fuzzy.confidence, matchedAlias: name };
      }
    }
    return null;
  }
  return { ...best, matchConfidence: bestScore >= 70 ? "high" : "medium" };
}

export function lookupUniversitiesInText(text) {
  const raw = stripPossessives(String(text ?? "").trim());
  if (!raw) return [];

  const found = new Map();
  const index = loadUniversityIndex();

  for (const [alias, targetName] of aliasLookup.entries()) {
    const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (!pattern.test(raw)) continue;
    const record = index.byName.get(normalizeKey(targetName));
    if (record) found.set(record.id, { ...record, matchConfidence: "high", matchedAlias: alias });
  }

  for (const record of index.all) {
    const nameKey = normalizeKey(record.title);
    if (nameKey.length > 10 && normalizeKey(raw).includes(nameKey)) {
      found.set(record.id, { ...record, matchConfidence: "high" });
    }
  }

  const primary = lookupUniversityInText(raw);
  if (primary) found.set(primary.id, primary);

  return [...found.values()].slice(0, 4);
}

function stripPossessives(text) {
  return String(text ?? "").replace(/\b([a-z0-9]+)'s\b/gi, "$1");
}

export function lookupUniversityInText(text) {
  const raw = stripPossessives(String(text ?? "").trim());
  if (!raw) return null;

  const normalized = normalizeKey(raw);
  if (aliasLookup.has(normalized)) {
    return lookupUniversityByName(raw);
  }

  const direct = lookupUniversityByName(raw);
  if (direct) return direct;

  const index = loadUniversityIndex();
  let best = null;
  let bestScore = 0;

  for (const record of index.all) {
    const nameKey = normalizeKey(record.title);
    if (normalized.includes(nameKey) && nameKey.length > 8) {
      const score = nameKey.length + 50;
      if (score > bestScore) {
        bestScore = score;
        best = record;
      }
      continue;
    }

    for (const [alias, targetName] of aliasLookup.entries()) {
      if (alias.length < 4) continue;
      const aliasPattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (!aliasPattern.test(raw)) continue;
      if (normalizeKey(record.title) === normalizeKey(targetName)) {
        const score = 90;
        if (score > bestScore) {
          bestScore = score;
          best = record;
        }
      }
    }

    const score = scoreNameMatch(raw, record.title);
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }

  if (!best || bestScore < 45) return null;
  return { ...best, matchConfidence: bestScore >= 75 ? "high" : "medium" };
}

export function listUniversities() {
  return loadUniversityIndex().all;
}
