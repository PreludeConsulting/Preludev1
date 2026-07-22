const TEXT_LIMIT = 240;
const LIST_LIMIT = 8;

function cleanText(value, max = TEXT_LIMIT) {
  if (value == null) return null;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function cleanList(value, max = LIST_LIMIT) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(typeof item === "string" ? item : item?.name || item?.title))
    .filter(Boolean)
    .slice(0, max);
}

function cleanScalar(value, max = 16) {
  return typeof value === "number" && Number.isFinite(value) ? value : cleanText(value, max);
}

function firstPresent(primary, fallback) {
  if (primary !== undefined && primary !== null && primary !== "") return primary;
  return fallback;
}

export function sanitizeStudentProfile(profile = {}) {
  const majors = cleanList(profile.majors ?? profile.targetMajors ?? (profile.focus ? [profile.focus] : []));
  const activities = cleanList(profile.activities ?? profile.extracurricularActivities);
  const colleges = cleanList(profile.colleges ?? profile.savedColleges ?? profile.collegeInterests);
  return {
    name: cleanText(profile.name, 120),
    role: cleanText(profile.role, 32),
    plan: cleanText(profile.planName ?? profile.plan, 32),
    grade: cleanText(profile.grade, 64),
    graduationYear: cleanScalar(profile.graduationYear, 8),
    focus: cleanText(profile.focus, 160),
    majors,
    targetMajors: majors,
    location: cleanText(profile.location, 160),
    gpa: cleanScalar(profile.gpa),
    sat: cleanScalar(profile.sat),
    act: cleanScalar(profile.act),
    budget: cleanText(profile.budget ?? profile.financialAidNotes, 240),
    financialAidNotes: cleanText(profile.financialAidNotes ?? profile.budget, 240),
    activities,
    extracurricularActivities: activities,
    colleges,
    savedColleges: colleges
  };
}

export function mergeStudentProfileForChat({ user, studentProfile, clientProfile = {} }) {
  const testScores = studentProfile?.testScores && typeof studentProfile.testScores === "object"
    ? studentProfile.testScores
    : {};
  const preferences = studentProfile?.preferences && typeof studentProfile.preferences === "object"
    ? studentProfile.preferences
    : {};
  const authenticated = Boolean(user);
  const serverMajors = Array.isArray(studentProfile?.targetMajors) ? studentProfile.targetMajors : [];
  const serverName = authenticated ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : null;

  return sanitizeStudentProfile({
    name: authenticated ? serverName : clientProfile.name,
    role: authenticated ? user.role : clientProfile.role,
    plan: authenticated ? user.plan : clientProfile.plan,
    grade: firstPresent(
      studentProfile?.graduationYear ? `Class of ${studentProfile.graduationYear}` : null,
      clientProfile.grade
    ),
    graduationYear: firstPresent(studentProfile?.graduationYear, clientProfile.graduationYear),
    focus: firstPresent(serverMajors.length ? serverMajors.slice(0, 3).join(", ") : null, clientProfile.focus),
    targetMajors: serverMajors.length ? serverMajors : clientProfile.targetMajors ?? clientProfile.majors,
    location: firstPresent(studentProfile?.location ?? preferences.location, clientProfile.location),
    gpa: firstPresent(studentProfile?.gpa, clientProfile.gpa),
    sat: firstPresent(testScores.sat ?? testScores.SAT, clientProfile.sat),
    act: firstPresent(testScores.act ?? testScores.ACT, clientProfile.act),
    budget: firstPresent(preferences.budget, clientProfile.budget ?? clientProfile.financialAidNotes),
    financialAidNotes: firstPresent(preferences.budget, clientProfile.financialAidNotes),
    activities: firstPresent(preferences.activities, clientProfile.activities ?? clientProfile.extracurricularActivities),
    colleges: firstPresent(preferences.colleges, clientProfile.colleges ?? clientProfile.savedColleges)
  });
}
