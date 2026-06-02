const MISSING = new Set(["", "NA", "N/A", "NULL", "null", "nan", "NaN"]);

export function parseOptionalNumber(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (MISSING.has(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOptionalRate(value) {
  const parsed = parseOptionalNumber(value);
  if (parsed == null) return null;
  if (parsed > 1) return parsed / 100;
  return parsed;
}

export function cleanText(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return MISSING.has(trimmed) ? null : trimmed;
}

export function clampLimit(value, defaultLimit = 10, maxLimit = 25) {
  if (value == null || value === "") return defaultLimit;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(parsed, maxLimit);
}

export function likePattern(query) {
  return `%${query.trim().replace(/[%_]/g, "")}%`;
}
