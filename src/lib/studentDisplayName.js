/**
 * Resolve the casual first name used in student dashboard greetings and chrome.
 * Prefers Prelude Match / preferred_name over placeholders and email-derived names.
 */

const PLACEHOLDER_FIRST_NAMES = new Set([
  "student",
  "user",
  "prelude",
  "account",
  "there",
  "demo"
]);

function cleanToken(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function looksLikeEmail(value) {
  return value.includes("@");
}

export function isPlaceholderDisplayName(value) {
  const cleaned = cleanToken(value);
  if (!cleaned) return true;
  if (looksLikeEmail(cleaned)) return true;
  return PLACEHOLDER_FIRST_NAMES.has(cleaned.toLowerCase());
}

export function firstNameFromFullName(fullName) {
  const cleaned = cleanToken(fullName);
  if (!cleaned || looksLikeEmail(cleaned)) return "";
  return cleaned.split(/\s+/).filter(Boolean)[0] || "";
}

/**
 * @param {{ preferredName?: string, firstName?: string, name?: string, questionnaireAnswers?: Record<string, unknown> } | null | undefined} user
 */
export function resolveStudentFirstName(user) {
  if (!user) return "";

  const fromMatch = user.questionnaireAnswers?.studentName;
  if (fromMatch && typeof fromMatch === "object" && !Array.isArray(fromMatch)) {
    const matchFirst = cleanToken(fromMatch.firstName);
    if (matchFirst && !isPlaceholderDisplayName(matchFirst)) return matchFirst;
  }

  const preferred = cleanToken(user.preferredName);
  if (preferred && !isPlaceholderDisplayName(preferred)) {
    return preferred.split(/\s+/).filter(Boolean)[0] || preferred;
  }

  const firstName = cleanToken(user.firstName);
  if (firstName && !isPlaceholderDisplayName(firstName)) {
    return firstName.split(/\s+/).filter(Boolean)[0] || firstName;
  }

  const fromFull = firstNameFromFullName(user.name);
  if (fromFull && !isPlaceholderDisplayName(fromFull)) return fromFull;

  return "";
}

/**
 * Prefill Match name fields from saved answers or account profile.
 * @param {{ preferredName?: string, firstName?: string, lastName?: string, name?: string, questionnaireAnswers?: Record<string, unknown> } | null | undefined} user
 */
export function buildPrefillStudentNameAnswer(user) {
  const saved = user?.questionnaireAnswers?.studentName;
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    const firstName = cleanToken(saved.firstName);
    const lastName = cleanToken(saved.lastName);
    if (firstName || lastName) {
      return { firstName, lastName };
    }
  }

  let firstName = cleanToken(user?.firstName);
  let lastName = cleanToken(user?.lastName);
  if (isPlaceholderDisplayName(firstName)) firstName = "";
  if (isPlaceholderDisplayName(lastName) || looksLikeEmail(lastName)) lastName = "";

  if (!firstName && !lastName) {
    const full = cleanToken(user?.name);
    if (full && !looksLikeEmail(full)) {
      const parts = full.split(/\s+/).filter(Boolean);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ");
      if (isPlaceholderDisplayName(firstName)) firstName = "";
    }
  }

  if (!firstName && !lastName) return null;
  return { firstName, lastName };
}
