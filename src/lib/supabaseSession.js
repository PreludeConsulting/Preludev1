/**
 * Maps a Supabase session + profile into the app user shape used by AuthContext
 * and the dashboard (matches attachFrontendFields from auth.js).
 */

import { getPlan, normalizePlanId } from "./plans.js";
import { ONBOARDING_STATUS } from "./onboardingRoutes.js";
import { mapOnboardingToUserFields } from "./preludeMatchService.js";
import { readParentInviteStepComplete } from "./parentLinks.js";
import { normalizeAuthProviders } from "./authSignInMethod.js";

export function mapSupabaseUser(session, profile = null, onboarding = null, hasAssignedMentor = false, mentorQuestionnaire = null) {
  if (!session?.user) return null;
  const u = session.user;
  const meta = u.user_metadata || {};
  const fullName = (profile?.full_name || meta.full_name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const role = (profile?.role || meta.role || "student").toLowerCase();
  const cachedPlan = typeof window !== "undefined" ? window.localStorage.getItem(`prelude_plan_${u.id}`) : null;
  const planId = normalizePlanId(profile?.plan_id || cachedPlan);
  const plan = planId ? getPlan(planId) : null;
  const onboardingFields = mapOnboardingToUserFields(onboarding, hasAssignedMentor);
  const parentInviteStepComplete =
    onboardingFields.parentInviteStepComplete || readParentInviteStepComplete(u.id);
  const authSignInMethods = normalizeAuthProviders(u.identities || [], u);
  const roleSelectionComplete = profile?.role_selection_complete !== false;

  let onboardingStatus = onboardingFields.onboardingStatus;
  if (!roleSelectionComplete) {
    onboardingStatus = null;
  } else if (role === "parent") {
    onboardingStatus = ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  } else if (!planId) onboardingStatus = ONBOARDING_STATUS.NEEDS_PLAN;
  else if (planId && onboardingStatus === ONBOARDING_STATUS.NEEDS_PLAN) {
    onboardingStatus = ONBOARDING_STATUS.NEEDS_MATCH;
  }

  return {
    id: u.id,
    email: u.email,
    firstName: firstName || "Student",
    lastName: rest.join(" ") || "User",
    name: fullName || u.email,
    role,
    plan: planId,
    planName: plan?.name || null,
    planSelected: Boolean(planId),
    emailVerified: Boolean(u.email_confirmed_at),
    authProvider: "supabase",
    authSignInMethods,
    avatarUrl: profile?.avatar_url || null,
    roleSelectionComplete,
    ...onboardingFields,
    parentInviteStepComplete,
    mentorOnboardingComplete: role === "mentor" ? Boolean(mentorQuestionnaire?.completed) : true,
    onboardingStatus
  };
}
