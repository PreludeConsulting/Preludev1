import { getDatabase } from "../db/sqlite.js";
import { clampLimit, cleanText, likePattern, parseOptionalNumber, parseOptionalRate } from "../db/values.js";
import { expandMajorSearchPattern } from "./majorSynonyms.js";
import { expandCollegeSearchQuery } from "./collegeAliases.js";
import { collegeSource } from "./sources.js";

function formatCollegeRow(row) {
  const averageNetPrice = parseOptionalNumber(row.average_net_price);
  const admissionRate = parseOptionalRate(row.admission_rate);

  return {
    unitid: cleanText(row.unitid),
    name: cleanText(row.name),
    city: cleanText(row.city),
    state: cleanText(row.state),
    zip: cleanText(row.zip),
    website: cleanText(row.website),
    admissionRate,
    satAverage: parseOptionalNumber(row.sat_average),
    undergradSize: parseOptionalNumber(row.undergrad_size),
    tuitionInState: parseOptionalNumber(row.tuition_in_state),
    tuitionOutOfState: parseOptionalNumber(row.tuition_out_of_state),
    averageNetPrice,
    completionRate4yr: parseOptionalRate(row.completion_rate_4yr),
    retentionRate: parseOptionalRate(row.retention_rate_full_time),
    medianDebt: parseOptionalNumber(row.median_debt),
    medianEarnings10yr: parseOptionalNumber(row.median_earnings_10yr),
    source: collegeSource(row)
  };
}

export function searchColleges({ q = "", state = "", maxNetPrice = "", major = "", limit = 20, offset = 0 } = {}) {
  const parsedLimit = clampLimit(limit, 10, 25);
  if (parsedLimit == null) {
    const error = new Error("limit must be a positive integer up to 25");
    error.code = "INVALID_LIMIT";
    throw error;
  }

  const parsedOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);

  const db = getDatabase();
  const conditions = [];
  const params = [];

  let trimmedQuery = expandCollegeSearchQuery(q);
  const majorTerm = expandMajorSearchPattern(major.trim());
  const stateCode = state.trim().toUpperCase();
  const maxPrice = parseOptionalNumber(maxNetPrice);

  if (!trimmedQuery && !stateCode && maxPrice == null && !majorTerm) {
    return { results: [], count: 0, limit: parsedLimit };
  }

  if (trimmedQuery) {
    const like = likePattern(trimmedQuery);
    conditions.push("(c.name LIKE ? OR c.city LIKE ? OR c.state LIKE ?)");
    params.push(like, like, like);
  }

  if (stateCode) {
    conditions.push("c.state = ?");
    params.push(stateCode);
  }

  if (maxNetPrice !== "" && maxNetPrice != null && maxPrice == null) {
    const error = new Error("maxNetPrice must be a valid number");
    error.code = "INVALID_MAX_NET_PRICE";
    throw error;
  }
  if (maxPrice != null) {
    conditions.push(
      "c.average_net_price IS NOT NULL AND c.average_net_price NOT IN ('', 'NA') AND CAST(c.average_net_price AS REAL) <= ?"
    );
    params.push(maxPrice);
  }

  const joinPrograms = Boolean(majorTerm);
  if (majorTerm) {
    const majorLike = likePattern(majorTerm);
    conditions.push("LOWER(f.cip_description) LIKE LOWER(?)");
    params.push(majorLike);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const joinClause = joinPrograms
    ? "INNER JOIN fields_of_study f ON f.unitid = c.unitid"
    : "";
  const distinct = joinPrograms ? "DISTINCT" : "";

  const sql = `
    SELECT ${distinct}
      c.unitid, c.name, c.city, c.state, c.zip, c.website,
      c.admission_rate, c.sat_average, c.undergrad_size,
      c.tuition_in_state, c.tuition_out_of_state, c.average_net_price,
      c.completion_rate_4yr, c.retention_rate_full_time, c.median_debt,
      c.median_earnings_10yr, c.source
    FROM colleges c
    ${joinClause}
    ${whereClause}
    ORDER BY
      CASE
        WHEN c.average_net_price IS NULL OR c.average_net_price IN ('', 'NA') THEN 1
        ELSE 0
      END,
      CAST(c.average_net_price AS REAL) ASC,
      c.name ASC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(sql).all(...params, parsedLimit, parsedOffset);
  return {
    results: rows.map(formatCollegeRow),
    count: rows.length,
    limit: parsedLimit,
    offset: parsedOffset
  };
}

export function getCollegeByUnitId(unitid) {
  const id = cleanText(unitid);
  if (!id) return null;

  const db = getDatabase();
  const row = db
    .prepare(
      `
      SELECT *
      FROM colleges
      WHERE unitid = ?
      LIMIT 1
      `
    )
    .get(id);

  if (!row) return null;

  const programs = db
    .prepare(
      `
      SELECT unitid, institution_name, cip_code, cip_description,
             credential_level, credential_description,
             median_earnings_1yr, median_debt, source
      FROM fields_of_study
      WHERE unitid = ?
      ORDER BY cip_description ASC
      LIMIT 12
      `
    )
    .all(id)
    .map((program) => ({
      cipCode: cleanText(program.cip_code),
      description: cleanText(program.cip_description),
      credentialDescription: cleanText(program.credential_description),
      medianEarnings1yr: parseOptionalNumber(program.median_earnings_1yr),
      medianDebt: parseOptionalNumber(program.median_debt),
      source: collegeSource(program)
    }));

  const college = formatCollegeRow(row);
  return {
    ...college,
    latitude: parseOptionalNumber(row.latitude),
    longitude: parseOptionalNumber(row.longitude),
    pellShare: parseOptionalRate(row.pell_share),
    programs
  };
}
