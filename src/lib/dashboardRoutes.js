import { appPath } from "./appPaths.js";

/** Role-based dashboard paths and redirects. */

export const STUDENT_DASHBOARD_BASE = "/dashboard/student";
export const MENTOR_DASHBOARD_BASE = "/dashboard/mentor";
export const PARENT_DASHBOARD_BASE = "/dashboard/parent";

export function dashboardHomeForRole(role) {
  const r = (role || "").toLowerCase();
  if (r === "mentor") return `${MENTOR_DASHBOARD_BASE}/overview`;
  if (r === "parent") return `${PARENT_DASHBOARD_BASE}/overview`;
  return `${STUDENT_DASHBOARD_BASE}/overview`;
}

export function isDashboardPath(pathname) {
  return pathname.startsWith("/dashboard");
}

export function roleFromUser(user) {
  return (user?.role || "student").toLowerCase();
}

export function canAccessDashboardRole(user, requiredRole) {
  return roleFromUser(user) === requiredRole;
}

export function redirectToDashboard(user) {
  window.location.href = appPath(dashboardHomeForRole(user?.role));
}
