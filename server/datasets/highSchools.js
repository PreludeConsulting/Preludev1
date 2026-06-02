import { getDatabase } from "../db/sqlite.js";
import { clampLimit, cleanText, likePattern } from "../db/values.js";
import { NCES_CCD_SOURCE } from "./sources.js";

const SCHOOL_ALIASES = {
  gsmst: "Gwinnett School of Mathematics Science and Technology",
  "gwinnett school of mathematics science and technology":
    "Gwinnett School of Mathematics Science and Technology"
};

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandQueryTerms(q) {
  const trimmed = q.trim();
  const terms = [trimmed];
  const normalized = normalizeSearchText(trimmed);

  for (const [alias, expanded] of Object.entries(SCHOOL_ALIASES)) {
    if (normalized === alias || normalized.includes(alias)) {
      terms.push(expanded);
    }
  }

  if (/^gsmst$/i.test(trimmed)) {
    terms.push("Gwinnett School of Mathematics");
    terms.push("Gwinnett School of Mathematics Science");
  }

  return [...new Set(terms.filter(Boolean))];
}

function formatHighSchoolRow(row) {
  return {
    ncesSchoolId: cleanText(row.nces_school_id),
    schoolName: cleanText(row.school_name),
    streetAddress: cleanText(row.street_address),
    city: cleanText(row.city),
    state: cleanText(row.state),
    zip: cleanText(row.zip),
    phone: cleanText(row.phone),
    districtName: cleanText(row.district_name),
    lowestGrade: cleanText(row.lowest_grade),
    highestGrade: cleanText(row.highest_grade),
    schoolStatus: cleanText(row.school_status),
    source: cleanText(row.source) ?? NCES_CCD_SOURCE
  };
}

function scoreMatch(row, terms) {
  const name = normalizeSearchText(row.school_name);
  let score = 0;

  for (const term of terms) {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) continue;
    if (name === normalizedTerm) score += 100;
    else if (name.includes(normalizedTerm)) score += 60;
    else if (normalizedTerm.includes(name) && name.length > 8) score += 40;
    else {
      const tokens = normalizedTerm.split(" ").filter((token) => token.length > 2);
      const hits = tokens.filter((token) => name.includes(token)).length;
      score += hits * 12;
    }
  }

  return score;
}

export function searchHighSchools({ q = "", state = "", city = "", limit = 10 } = {}) {
  const parsedLimit = clampLimit(limit, 10, 25);
  if (parsedLimit == null) {
    const error = new Error("limit must be a positive integer up to 25");
    error.code = "INVALID_LIMIT";
    throw error;
  }

  const trimmedQuery = q.trim();
  const stateCode = state.trim().toUpperCase();
  const cityTerm = city.trim();

  if (!trimmedQuery && !stateCode && !cityTerm) {
    return { results: [], count: 0, limit: parsedLimit, source: NCES_CCD_SOURCE };
  }

  const db = getDatabase();
  const searchTerms = expandQueryTerms(trimmedQuery);
  const conditions = ["1=1"];
  const params = [];

  if (stateCode) {
    conditions.push("state = ?");
    params.push(stateCode);
  }

  if (cityTerm) {
    conditions.push("city LIKE ?");
    params.push(likePattern(cityTerm));
  }

  const nameClauses = [];
  for (const term of searchTerms) {
    const like = likePattern(term);
    nameClauses.push(
      "(school_name LIKE ? OR district_name LIKE ? OR REPLACE(REPLACE(LOWER(school_name), ',', ''), '.', '') LIKE ?)"
    );
    const normalizedLike = `%${normalizeSearchText(term).replace(/\s+/g, "%")}%`;
    params.push(like, like, normalizedLike);
  }

  if (nameClauses.length) {
    conditions.push(`(${nameClauses.join(" OR ")})`);
  }

  const sql = `
    SELECT *
    FROM public_high_schools
    WHERE ${conditions.join(" AND ")}
    LIMIT 200
  `;

  const rows = db.prepare(sql).all(...params);
  const ranked = rows
    .map((row) => ({ row, score: scoreMatch(row, searchTerms) }))
    .filter((item) => item.score > 0 || !trimmedQuery)
    .sort((a, b) => b.score - a.score)
    .slice(0, parsedLimit)
    .map((item) => formatHighSchoolRow(item.row));

  return {
    results: ranked,
    count: ranked.length,
    limit: parsedLimit,
    source: NCES_CCD_SOURCE
  };
}
