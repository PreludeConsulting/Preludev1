import { DEMO_STUDENT, DEMO_STUDENT_2 } from "../../data/demoAccounts.js";
import { DEMO_SLUGS, getDemoDashboardForUser } from "../../data/demoDashboardData.js";
import { resolveStudentUserId } from "./sharedCalendarEvents.js";

export function getStudentDemoBundleBySlug(studentId) {
  const email = resolveStudentEmailBySlug(studentId);
  if (!email) return null;
  return getDemoDashboardForUser(email, "STUDENT");
}

export function resolveStudentEmailBySlug(studentId) {
  if (studentId === DEMO_SLUGS.jordan) return DEMO_STUDENT.email;
  if (studentId === DEMO_SLUGS.alex) return DEMO_STUDENT_2.email;
  return null;
}

export function resolveStudentAuthUser(student) {
  if (!student?.id) return null;

  const email = resolveStudentEmailBySlug(student.id);
  if (!email) {
    return {
      id: resolveStudentUserId(student.id) || student.id,
      email: `${student.id}@prelude.local`,
      name: student.name,
      role: "STUDENT",
      authProvider: "local"
    };
  }

  return {
    id: resolveStudentUserId(student.id),
    email,
    name: student.name,
    role: "STUDENT",
    authProvider: "demo"
  };
}
