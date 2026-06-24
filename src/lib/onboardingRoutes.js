import { PLAN_IDS } from "./plans.js";
import { dashboardHomeForRole, roleFromUser, STUDENT_DASHBOARD_BASE, MENTOR_DASHBOARD_BASE, PARENT_DASHBOARD_BASE } from "./dashboardRoutes.js";

export const PLAN_SELECTION_PATH = "/onboarding/plan";
export const ROLE_SELECTION_PATH = "/onboarding/role";
export const MATCH_ONBOARDING_PATH = "/onboarding/match";
export const PARENT_ONBOARDING_PATH = "/onboarding/parent";
export const MENTOR_ONBOARDING_PATH = "/onboarding/mentor";

export const ONBOARDING_STATUS = {
  NEEDS_PLAN: "needs_plan",
  NEEDS_MATCH: "needs_match",
  MATCH_COMPLETED: "match_completed",
  ONBOARDING_COMPLETED: "onboarding_completed"
};

export function isValidPlanId(planId) {
  return PLAN_IDS.includes(planId);
}

export function studentRoute(segment = "") {
  const base = STUDENT_DASHBOARD_BASE;
  if (!segment) return base;
  return `${base}/${segment.replace(/^\//, "")}`;
}

export function mentorRoute(segment = "") {
  const base = MENTOR_DASHBOARD_BASE;
  if (!segment) return base;
  return `${base}/${segment.replace(/^\//, "")}`;
}

export function dashboardPathForRole(role) {
  return dashboardHomeForRole(role);
}

export function settingsPathForRole(role) {
  const r = roleFromUser({ role });
  if (r === "mentor") return mentorRoute("settings");
  if (r === "parent") return `${PARENT_DASHBOARD_BASE}/overview`;
  return studentRoute("settings");
}

/** @deprecated Use settingsPathForRole — profile lives in Settings. */
export function profilePathForRole(role) {
  return `${settingsPathForRole(role)}#profile`;
}

export function billingPathForRole(role) {
  const r = roleFromUser({ role });
  return r === "mentor" ? mentorRoute("billing") : studentRoute("billing");
}

export function helpPathForRole(role) {
  const r = roleFromUser({ role });
  return r === "mentor" ? mentorRoute("help") : studentRoute("help");
}

export function notificationsPathForRole(role) {
  const r = roleFromUser({ role });
  return r === "mentor" ? mentorRoute("notifications") : studentRoute("notifications");
}

export function resourcesPathForRole(role) {
  return studentRoute("resources");
}

export function messagesPathForRole(role) {
  const r = roleFromUser({ role });
  return r === "mentor" ? mentorRoute("messages") : studentRoute("messages");
}

export function calendarPathForRole(role) {
  const r = roleFromUser({ role });
  return r === "mentor" ? mentorRoute("calendar") : studentRoute("calendar");
}

export function preludeMatchPathForRole(role) {
  const r = roleFromUser({ role });
  if (r === "mentor") return mentorRoute("students");
  return studentRoute("prelude-match");
}

export function myMentorsPathForRole(role) {
  return studentRoute("mentor");
}

export function deriveOnboardingStatus(user, onboarding, hasAcceptedMentor = false) {
  if (!user) return null;
  const role = roleFromUser(user);
  if (role === "mentor" || role === "parent") return ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  if (!user.planSelected) return ONBOARDING_STATUS.NEEDS_PLAN;
  if (!onboarding?.mentor_matching_complete) return ONBOARDING_STATUS.NEEDS_MATCH;
  if (hasAcceptedMentor || onboarding?.match_decision === "accepted") {
    return ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  }
  if (onboarding?.match_decision === "declined" || onboarding?.suggested_mentor_id) {
    return ONBOARDING_STATUS.MATCH_COMPLETED;
  }
  return ONBOARDING_STATUS.NEEDS_MATCH;
}

export function userNeedsPlanSelection(user) {
  if (!user) return false;
  if (userNeedsRoleSelection(user)) return false;
  const role = roleFromUser(user);
  if (role === "mentor" || role === "parent") return false;
  if (user.onboardingStatus) return user.onboardingStatus === ONBOARDING_STATUS.NEEDS_PLAN;
  if (user.authProvider === "supabase") return !user.planSelected;
  return !user.plan;
}

export function userNeedsRoleSelection(user) {
  if (!user) return false;
  if (user.authProvider === "demo" || user.authProvider === "dev") return false;
  if (user.authProvider !== "supabase") return false;
  return user.roleSelectionComplete === false;
}

export function userNeedsMatchOnboarding(user) {
  if (!user || roleFromUser(user) !== "student") return false;
  // Only Supabase students go through Prelude Match onboarding.
  if (user.authProvider !== "supabase") return false;
  if (!user.planSelected) return false;
  if (user.onboardingStatus) {
    return user.onboardingStatus === ONBOARDING_STATUS.NEEDS_MATCH;
  }
  return !user.matchOnboardingComplete;
}

export function userNeedsMatchDecision(user) {
  if (!user || roleFromUser(user) !== "student") return false;
  return user.onboardingStatus === ONBOARDING_STATUS.MATCH_COMPLETED && !user.matchDecision;
}

export function userNeedsMentorOnboarding(user) {
  if (!user || roleFromUser(user) !== "mentor") return false;
  if (user.authProvider === "demo" || user.authProvider === "dev") return false;
  if (user.authProvider !== "supabase") return false;
  return !user.mentorOnboardingComplete;
}

export function userNeedsParentInviteStep(user) {
  if (!user || roleFromUser(user) !== "student") return false;
  if (user.authProvider === "demo" || user.authProvider === "dev") return false;
  if (user.parentInviteStepComplete) return false;
  if (userNeedsPlanSelection(user)) return false;
  if (userNeedsMatchOnboarding(user)) return false;
  if (userNeedsMatchDecision(user)) return false;
  return true;
}

export function postAuthDestination(user) {
  if (!user) return "/login";
  if (userNeedsRoleSelection(user)) return ROLE_SELECTION_PATH;
  if (userNeedsPlanSelection(user)) return PLAN_SELECTION_PATH;
  if (userNeedsMentorOnboarding(user)) return MENTOR_ONBOARDING_PATH;
  if (userNeedsMatchOnboarding(user)) return MATCH_ONBOARDING_PATH;
  if (userNeedsMatchDecision(user)) return `${MATCH_ONBOARDING_PATH}?step=result`;
  if (userNeedsParentInviteStep(user)) return PARENT_ONBOARDING_PATH;
  return dashboardPathForRole(user.role);
}

export function canAccessDashboard(user) {
  if (!user) return false;
  if (userNeedsRoleSelection(user)) return false;
  if (roleFromUser(user) === "parent") return true;
  if (userNeedsPlanSelection(user)) return false;
  if (userNeedsMentorOnboarding(user)) return false;
  if (roleFromUser(user) === "mentor") return true;
  if (userNeedsMatchOnboarding(user)) return false;
  if (userNeedsMatchDecision(user)) return false;
  if (userNeedsParentInviteStep(user)) return false;
  return true;
}
