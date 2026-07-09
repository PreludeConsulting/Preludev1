function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle(items, seed) {
  const copy = [...items];
  let state = seed >>> 0;

  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function resolveMentorHelpSpecialties(mentor) {
  if (!mentor) return [];
  if (Array.isArray(mentor.specialties)) {
    return mentor.specialties.map((item) => String(item).trim()).filter(Boolean);
  }
  return [];
}

/** Up to 2 stable tags from "Where can you help students most?" only. */
export function pickMentorNetworkCardTags(mentor) {
  const specialties = resolveMentorHelpSpecialties(mentor);
  if (!specialties.length) return [];

  const seed = hashString(String(mentor.id || mentor.mentor_user_id || mentor.name || ""));
  const shuffled = seededShuffle(specialties, seed);
  return shuffled.slice(0, Math.min(2, specialties.length));
}
