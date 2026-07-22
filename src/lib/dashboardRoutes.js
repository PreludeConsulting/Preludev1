import { appPath } from "./appPaths.js";
import { hasMatchingTeamAccess } from "../../shared/matchingTeamAccess.js";
import { DASHBOARD_ROUTE_BASES } from "../../shared/appRouteRegistry.js";

/** Role-based dashboard paths and redirects. */

export const STUDENT_DASHBOARD_BASE = DASHBOARD_ROUTE_BASES.student;
export const MENTOR_DASHBOARD_BASE = DASHBOARD_ROUTE_BASES.mentor;
export const PARENT_DASHBOARD_BASE = DASHBOARD_ROUTE_BASES.parent;
export const ADMIN_DASHBOARD_BASE = DASHBOARD_ROUTE_BASES.admin;

const LEGACY_DASHBOARD_TARGETS = Object.freeze({
  student: Object.freeze({
    resources: `${STUDENT_DASHBOARD_BASE}/help`,
    profile: `${STUDENT_DASHBOARD_BASE}/settings`,
    "mentor-matching": `${STUDENT_DASHBOARD_BASE}/prelude-match`
  }),
  mentor: Object.freeze({
    profile: `${MENTOR_DASHBOARD_BASE}/settings`,
    billing: `${MENTOR_DASHBOARD_BASE}/settings`
  }),
  parent: Object.freeze({
    profile: `${PARENT_DASHBOARD_BASE}/settings`
  })
});

export function dashboardHomeForRole(role) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return `${ADMIN_DASHBOARD_BASE}/matching`;
  if (r === "mentor") return `${MENTOR_DASHBOARD_BASE}/overview`;
  if (r === "parent") return `${PARENT_DASHBOARD_BASE}/overview`;
  return `${STUDENT_DASHBOARD_BASE}/overview`;
}

export function dashboardFallbackForRole(role) {
  return dashboardHomeForRole(role);
}

export function dashboardLegacyTarget(role, alias) {
  return LEGACY_DASHBOARD_TARGETS[String(role || "").toLowerCase()]?.[alias] || null;
}

export function hasAdminDashboardAccess(user) {
  return hasMatchingTeamAccess(user);
}

export function dashboardHomeForUser(user) {
  if (roleFromUser(user) === "admin") return `${ADMIN_DASHBOARD_BASE}/matching`;
  return dashboardHomeForRole(user?.role);
}

export function isDashboardPath(pathname) {
  return pathname.startsWith("/dashboard");
}

export function roleFromUser(user) {
  return (user?.role || "student").toLowerCase();
}

export function dashboardRoleLabel(role) {
  const normalized = (role || "student").toLowerCase();
  if (normalized === "mentor") return "Mentor";
  if (normalized === "parent") return "Parent";
  return "Student";
}

export function canAccessDashboardRole(user, requiredRole) {
  if (requiredRole === "admin") return hasAdminDashboardAccess(user);
  return roleFromUser(user) === requiredRole;
}

export function redirectToDashboard(user) {
  window.location.href = appPath(dashboardHomeForUser(user));
}
