/**
 * Derive academic progress from shared student data.
 */

export function deriveAcademicProgress(profile, applicationProgress = null) {
  if (!profile) return null;

  const gpa = parseFloat(profile.gpa);
  const apCount = Number(profile.apHonors || profile.apCourses || 0);
  const activityCount = Array.isArray(profile.activities)
    ? profile.activities.length
    : Array.isArray(profile.extracurriculars)
      ? profile.extracurriculars.length
      : 0;
  const leadershipCount = Array.isArray(profile.leadership) ? profile.leadership.length : 0;

  if (!gpa && !profile.sat && !activityCount && !applicationProgress) return null;

  return {
    gpaStrength: gpa
      ? Math.min(100, Math.round((gpa / 4) * 96))
      : applicationProgress?.profile ?? 70,
    courseRigor: apCount
      ? Math.min(100, apCount * 14)
      : applicationProgress?.collegeList ?? 65,
    activities: activityCount
      ? Math.min(100, activityCount * 18)
      : applicationProgress?.extracurriculars ?? 55,
    leadership: leadershipCount
      ? Math.min(100, leadershipCount * 28)
      : applicationProgress?.scholarships ?? 50
  };
}
