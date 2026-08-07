/**
 * Presentation helpers for the student-facing “My Mentor” profile card.
 * Sourced from assigned mentor Settings → Profile / matching profile data.
 */

function cleanText(value) {
  return String(value || "").trim();
}

export function asStringArray(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeCollegeKey(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

/**
 * Mentor’s own college first, then up to 2 unique target schools.
 */
export function buildMentorCollegeLine(mentor) {
  if (!mentor) return [];
  const own =
    cleanText(mentor.college) ||
    cleanText(mentor.university) ||
    cleanText(mentor.school);
  const targets = asStringArray(mentor.targetSchools || mentor.target_schools);
  const seen = new Set();
  const colleges = [];

  function push(name) {
    const key = normalizeCollegeKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    colleges.push(cleanText(name));
  }

  if (own) push(own);
  for (const school of targets) {
    if (colleges.length >= 3) break; // own + up to 2 targets
    push(school);
  }
  return colleges;
}

export function formatMentorCollegeLine(mentor) {
  return buildMentorCollegeLine(mentor).join(" · ");
}

/** Stable 32-bit hash for deterministic picks (no Math.random in render). */
export function hashMentorSeed(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickStableOption(options, seed) {
  const list = asStringArray(options);
  if (!list.length) return null;
  return list[hashMentorSeed(seed) % list.length];
}

/**
 * One tag from each populated checkbox section:
 * specialties (“Where can you help…”),
 * targetMajors (“academic areas”),
 * supportStyles (“mentoring style”).
 */
export function pickStableMentorCardTags(mentor) {
  if (!mentor) return [];
  const mentorKey =
    mentor.mentorUserId ||
    mentor.userId ||
    mentor.mentorId ||
    mentor.id ||
    mentor.name ||
    "mentor";

  const tags = [
    pickStableOption(mentor.specialties, `${mentorKey}:specialties`),
    pickStableOption(mentor.targetMajors || mentor.target_majors, `${mentorKey}:targetMajors`),
    pickStableOption(mentor.supportStyles || mentor.support_styles, `${mentorKey}:supportStyles`)
  ].filter(Boolean);

  // De-dupe while preserving order (unlikely across sections, but safe).
  const seen = new Set();
  return tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveMentorCardPhoto(mentor) {
  if (!mentor) return "";
  return (
    cleanText(mentor.headshot) ||
    cleanText(mentor.avatarUrl) ||
    cleanText(mentor.avatar_url) ||
    cleanText(mentor.photo) ||
    ""
  );
}

export function resolveMentorCardMajor(mentor) {
  return cleanText(mentor?.major);
}

export function resolveMentorCardGraduationYear(mentor) {
  const raw = mentor?.graduationYear ?? mentor?.graduation_year;
  if (raw == null || raw === "") return "";
  const text = String(raw).trim();
  if (!text) return "";
  // Accept "2027" or "Class of 2027"
  const match = text.match(/(?:class of\s*)?(\d{4})/i);
  return match ? match[1] : text;
}

export function resolveMentorCardBio(mentor) {
  return cleanText(mentor?.bio);
}

/**
 * Merge mentor_matches row with live matching profile + account profile fields.
 * Matching-profile / account data wins over denormalized match snapshot for display fields.
 */
export function enrichAssignedMentorMatch(match, matchingProfile = null, accountProfile = null) {
  if (!match) return null;
  const mp = matchingProfile || {};
  const ap = accountProfile || {};

  const college = cleanText(mp.college) || cleanText(match.college) || cleanText(match.university);
  const major = cleanText(mp.major) || cleanText(match.major);
  const bio = cleanText(mp.bio) || cleanText(match.bio);
  const specialties = asStringArray(mp.specialties).length
    ? asStringArray(mp.specialties)
    : asStringArray(match.specialties || match.expertise);
  const targetMajors = asStringArray(mp.target_majors ?? match.targetMajors ?? match.target_majors);
  const targetSchools = asStringArray(mp.target_schools ?? match.targetSchools ?? match.target_schools);
  const supportStyles = asStringArray(mp.support_styles ?? match.supportStyles ?? match.support_styles);
  const applicationStrengths = asStringArray(
    mp.application_strengths ?? match.applicationStrengths ?? match.application_strengths
  );
  const avatarUrl =
    cleanText(ap.avatar_url) ||
    cleanText(ap.avatarUrl) ||
    cleanText(mp.avatar_url) ||
    cleanText(mp.avatarUrl) ||
    cleanText(match.avatarUrl) ||
    cleanText(match.headshot) ||
    cleanText(match.photo);
  const graduationYear =
    ap.graduation_year ?? ap.graduationYear ?? match.graduationYear ?? match.graduation_year ?? null;
  const displayName =
    cleanText(mp.display_name) || cleanText(ap.full_name) || cleanText(match.name);

  return {
    ...match,
    name: displayName || match.name,
    college,
    university: college || match.university,
    major,
    bio: bio || null,
    specialties,
    targetMajors,
    targetSchools,
    supportStyles,
    applicationStrengths,
    expertise: specialties.length ? specialties : asStringArray(match.expertise),
    availability: cleanText(mp.availability) || match.availability || "",
    availabilitySchedule:
      mp.availability_schedule || match.availabilitySchedule || match.availability_schedule || null,
    graduationYear: graduationYear != null && graduationYear !== "" ? String(graduationYear) : null,
    avatarUrl: avatarUrl || null,
    headshot: avatarUrl || match.headshot || null
  };
}
