import { DEMO_STUDENT, DEMO_STUDENT_2 } from "../../data/demoAccounts.js";
import { DEMO_SLUGS, getDemoDashboardForUser } from "../../data/demoDashboardData.js";

export function getStudentDemoBundleBySlug(studentId) {
  const email = studentId === DEMO_SLUGS.jordan
    ? DEMO_STUDENT.email
    : studentId === DEMO_SLUGS.alex
      ? DEMO_STUDENT_2.email
      : null;
  if (!email) return null;
  return getDemoDashboardForUser(email, "STUDENT");
}
