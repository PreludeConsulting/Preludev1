import { getDatabase } from "../db/sqlite.js";
import { clampLimit, cleanText, likePattern } from "../db/values.js";
import { ONET_SOURCE } from "./sources.js";

function formatCareerRow(row) {
  return {
    code: cleanText(row.o_net_soc_code),
    title: cleanText(row.title),
    description: cleanText(row.description),
    source: ONET_SOURCE
  };
}

export function searchCareers({ q = "", limit = 10 } = {}) {
  const parsedLimit = clampLimit(limit, 10, 25);
  if (parsedLimit == null) {
    const error = new Error("limit must be a positive integer up to 25");
    error.code = "INVALID_LIMIT";
    throw error;
  }

  const db = getDatabase();
  const trimmedQuery = q.trim();
  let rows;

  if (trimmedQuery) {
    const like = likePattern(trimmedQuery);
    rows = db
      .prepare(
        `
        SELECT o_net_soc_code, title, description
        FROM onet_occupations
        WHERE title LIKE ? OR description LIKE ?
        ORDER BY title ASC
        LIMIT ?
        `
      )
      .all(like, like, parsedLimit);
  } else {
    rows = db
      .prepare(
        `
        SELECT o_net_soc_code, title, description
        FROM onet_occupations
        ORDER BY title ASC
        LIMIT ?
        `
      )
      .all(parsedLimit);
  }

  return {
    results: rows.map(formatCareerRow),
    count: rows.length,
    limit: parsedLimit
  };
}

export function getCareerSkills(code, limit = 5) {
  const occupationCode = cleanText(code);
  if (!occupationCode) return [];

  const db = getDatabase();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);

  if (!tables.includes("onet_task_statements")) return [];

  return db
    .prepare(
      `
      SELECT task
      FROM onet_task_statements
      WHERE o_net_soc_code = ?
      ORDER BY CAST(incumbents_responding AS REAL) DESC
      LIMIT ?
      `
    )
    .all(occupationCode, limit)
    .map((row) => cleanText(row.task))
    .filter(Boolean);
}
