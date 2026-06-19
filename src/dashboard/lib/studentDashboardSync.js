import { resolveStudentUserId } from "./sharedCalendarEvents.js";

export const STUDENT_DASHBOARD_SYNC_EVENT = "prelude-student-dashboard-sync";

export function resolveSyncedStudentKey(studentId) {
  if (!studentId) return null;
  return String(studentId);
}

export function notifyStudentDashboardChanged(studentId) {
  const key = resolveSyncedStudentKey(studentId);
  if (!key || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(STUDENT_DASHBOARD_SYNC_EVENT, { detail: { studentId: key } })
  );
}

export function subscribeStudentDashboardChanged(handler) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(STUDENT_DASHBOARD_SYNC_EVENT, handler);
  return () => window.removeEventListener(STUDENT_DASHBOARD_SYNC_EVENT, handler);
}

export function matchesStudentSyncTarget(detail, { userId, mentorViewStudent, parentViewStudent }) {
  if (!detail?.studentId) return false;
  const target = detail.studentId;
  const userKeys = [userId, resolveStudentUserId(userId)].filter(Boolean);
  if (userKeys.includes(target)) return true;
  if (mentorViewStudent?.id) {
    const keys = [mentorViewStudent.id, resolveStudentUserId(mentorViewStudent.id)].filter(Boolean);
    if (keys.includes(target)) return true;
  }
  if (parentViewStudent?.id) {
    const keys = [parentViewStudent.id, resolveStudentUserId(parentViewStudent.id)].filter(Boolean);
    if (keys.includes(target)) return true;
  }
  return false;
}

export function matchesAssignedStudentSync(detail, students = []) {
  if (!detail?.studentId || !students.length) return false;
  const target = detail.studentId;
  return students.some((student) => {
    const keys = [student.id, resolveStudentUserId(student.id)].filter(Boolean);
    return keys.includes(target);
  });
}
