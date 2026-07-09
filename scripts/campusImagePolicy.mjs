/**
 * Campus image selection policy for college cards.
 *
 * Accept: bird's-eye / aerial campus views; clear campus buildings, quads, libraries, towers.
 * Reject: city skylines, town photos, generic student shots, logos, people-focused images,
 * standalone stadiums, and images where the campus is not obvious.
 */

export const CAMPUS_IMAGE_POLICY = `
College card images must be either:
1. A bird's-eye / aerial view of the actual campus, OR
2. A clean campus-only photo with recognizable buildings, quads, libraries, towers, or landmarks.

Do NOT use city skylines, random neighborhoods, generic student photos, logos, or people-focused shots.
Prioritize aerial campus views whenever available.
`;

const REJECT_TITLE =
  /\b(logo|seal|emblem|coat of arms|map\.svg|diagram|chart|skyline|cityscape|downtown|city view|panorama of (?:the )?city|stadium|football field|basketball arena|graduation|commencement|student(?:s)?|people|crowd|portrait|mascot|athletics|sports team|game day|tailgate|marching band|classroom|lecture hall interior|library interior)\b/i;

const PREFER_TITLE =
  /\b(aerial|birds.?eye|bird.?s.?eye|from above|overview|campus|university|college|quad|library|hall|tower|chapel|dorm|academic|landmark|main building|administration building)\b/i;

const AERIAL_TITLE = /\b(aerial|birds.?eye|bird.?s.?eye|from above|overview|satellite)\b/i;

/** Distinctive title phrases per campus id (lowercase). */
const SCHOOL_TITLE_TOKENS = {
  american: ["american university"],
  asu: ["arizona state"],
  bu: ["boston university"],
  caltech: ["california institute of technology", "caltech"],
  cmu: ["carnegie mellon"],
  "georgia-state": ["georgia state university", "georgia state"],
  "georgia-tech": ["georgia institute of technology", "georgia tech"],
  gwu: ["george washington university"],
  mit: ["massachusetts institute of technology", "mit"],
  msu: ["michigan state university", "michigan state"],
  nyu: ["new york university", "nyu"],
  "nc-state": ["north carolina state university", "nc state"],
  "ohio-state": ["ohio state university", "ohio state"],
  "penn-state": ["pennsylvania state university", "penn state"],
  tamu: ["texas a&m", "texas a and m"],
  "uc-berkeley": ["uc berkeley", "berkeley campus", "university of california berkeley"],
  "uc-davis": ["uc davis", "university of california davis"],
  uci: ["uc irvine", "university of california irvine"],
  ucla: ["ucla", "university of california los angeles"],
  ucsd: ["uc san diego", "university of california san diego"],
  uf: ["university of florida"],
  uiuc: ["university of illinois urbana", "urbana-champaign"],
  umd: ["university of maryland"],
  unc: ["university of north carolina", "chapel hill"],
  upenn: ["university of pennsylvania", "upenn"],
  usc: ["university of southern california", "usc"],
  "ut-austin": ["university of texas austin"],
  uva: ["university of virginia"],
  uw: ["university of washington"],
  "virginia-tech": ["virginia tech"]
};

export function getSchoolTitleTokens(schoolId, schoolLabel) {
  if (SCHOOL_TITLE_TOKENS[schoolId]) {
    return SCHOOL_TITLE_TOKENS[schoolId];
  }

  const label = schoolLabel.replace(/\s+campus$/i, "").trim();
  const normalized = label.toLowerCase();
  const ofMatch = label.match(/University of (.+)$/i);
  if (ofMatch) {
    return [normalized, ofMatch[1].toLowerCase()];
  }

  const leadingMatch = label.match(/^(.+?)\s+(University|College|Institute)\b/i);
  if (leadingMatch) {
    return [normalized];
  }

  return [normalized];
}

export function titleMatchesSchool(title = "", tokens = []) {
  const normalized = String(title).replace(/^File:/i, "").toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

export function scoreCampusImageTitle(title = "", tokens = []) {
  const normalized = String(title).replace(/^File:/i, "").trim();
  if (!normalized) return -1;
  if (!titleMatchesSchool(normalized, tokens)) return -1;
  if (REJECT_TITLE.test(normalized)) return -1;
  if (/\.svg$/i.test(normalized)) return -1;

  let score = 0;
  if (PREFER_TITLE.test(normalized)) score += 2;
  if (/\bcampus\b/i.test(normalized)) score += 3;
  if (/\b(university|college)\b/i.test(normalized)) score += 1;
  if (AERIAL_TITLE.test(normalized)) score += 6;
  return score;
}

export function buildCampusSearchQueries(schoolLabel) {
  const base = schoolLabel.replace(/\s+campus$/i, "").trim();
  return [
    `${base} aerial view campus`,
    `${base} campus aerial`,
    `${base} university campus from above`,
    `${base} campus quad`,
    `${base} campus landmark building`,
    `${base} university campus`
  ];
}

export function pickBestCampusSearchHit(results = [], tokens = []) {
  let best = null;
  for (const hit of results) {
    const title = hit.title?.replace(/^File:/, "") || "";
    const score = scoreCampusImageTitle(title, tokens);
    if (score < 0) continue;
    if (!best || score > best.score) {
      best = { title, score };
    }
  }
  return best;
}
