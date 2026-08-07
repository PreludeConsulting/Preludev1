/**
 * Mentor Progress Rewards access helpers.
 *
 * Mentor student view wraps a synthetic student user (`authProvider: "local"`),
 * so assignment must NOT key off studentUser.authProvider. Use the authenticated
 * mentor (auth.uid()) and mentorViewStudent.id (profiles.id / mentor_matches.student_id).
 */

export function resolveProgressRewardsStudentId({
  isMentorStudentView = false,
  mentorViewStudentId = null,
  userId = null
} = {}) {
  if (isMentorStudentView && mentorViewStudentId) return mentorViewStudentId;
  return userId || null;
}

export function shouldUseRemoteProgressRewards({
  isMentorStudentView = false,
  mentorViewStudentId = null,
  studentAuthProvider = null,
  authAuthProvider = null,
  studentUserId = null
} = {}) {
  if (studentAuthProvider === "supabase" && studentUserId) return true;
  return Boolean(
    isMentorStudentView && authAuthProvider === "supabase" && mentorViewStudentId
  );
}
