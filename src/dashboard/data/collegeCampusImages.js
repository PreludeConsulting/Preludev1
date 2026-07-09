const mediaBase = import.meta.env.BASE_URL;

/**
 * Campus image policy for college explore cards:
 * - Prefer bird's-eye / aerial views of the actual campus.
 * - Otherwise use clear campus-only photos (buildings, quads, libraries, towers).
 * - Never use city skylines, generic student photos, logos, or people-focused shots.
 *
 * Local assets live in public/media/campuses/{id}.jpg.
 * Bulk updates can be imported from the curated PDF via:
 *   npm run import:campus-images:pdf -- "/path/to/College _ Images.pdf"
 */

/** Local campus assets used as last-resort fallbacks (verified campus scenes). */
const FALLBACK_CAMPUS_IDS = ["stanford", "princeton", "yale", "duke", "mit", "harvard"];

export function getCollegeCampusFallback(rank = 1) {
  const id = FALLBACK_CAMPUS_IDS[(rank - 1) % FALLBACK_CAMPUS_IDS.length];
  return `${mediaBase}media/campuses/${id}.jpg`;
}

export function getCollegeCampusImage(id) {
  return `${mediaBase}media/campuses/${id}.jpg`;
}
