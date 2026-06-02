import { getDatabase } from "../db/sqlite.js";
import { clampLimit, cleanText, likePattern, parseOptionalNumber } from "../db/values.js";
import { expandMajorSearchPattern } from "./majorSynonyms.js";
import { collegeSource } from "./sources.js";

function formatProgramRow(row) {
  return {
    unitid: cleanText(row.unitid),
    institutionName: cleanText(row.institution_name),
    state: cleanText(row.state),
    city: cleanText(row.city),
    cipCode: cleanText(row.cip_code),
    programDescription: cleanText(row.cip_description),
    credentialDescription: cleanText(row.credential_description),
    medianEarnings1yr: parseOptionalNumber(row.median_earnings_1yr),
    medianDebt: parseOptionalNumber(row.median_debt),
    source: collegeSource(row)
  };
}

export function searchPrograms({ q = "", state = "", limit = 10 } = {}) {
  const parsedLimit = clampLimit(limit, 10, 25);
  if (parsedLimit == null) {
    const error = new Error("limit must be a positive integer up to 25");
    error.code = "INVALID_LIMIT";
    throw error;
  }

  const db = getDatabase();
  const conditions = [];
  const params = [];

  const trimmedQuery = expandMajorSearchPattern(q.trim());
  const stateCode = state.trim().toUpperCase();

  if (!trimmedQuery && !stateCode) {
    return { results: [], count: 0, limit: parsedLimit };
  }

  if (trimmedQuery) {
    const like = likePattern(trimmedQuery);
    conditions.push("LOWER(f.cip_description) LIKE LOWER(?)");
    params.push(like);
  }

  if (stateCode) {
    conditions.push("c.state = ?");
    params.push(stateCode);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      f.unitid, f.institution_name, f.cip_code, f.cip_description,
      f.credential_level, f.credential_description,
      f.median_earnings_1yr, f.median_debt, f.source,
      c.state, c.city
    FROM fields_of_study f
    LEFT JOIN colleges c ON c.unitid = f.unitid
    ${whereClause}
    ORDER BY f.institution_name ASC, f.cip_description ASC
    LIMIT ?
  `;

  const rows = db.prepare(sql).all(...params, parsedLimit);
  return {
    results: rows.map(formatProgramRow),
    count: rows.length,
    limit: parsedLimit
  };
}
