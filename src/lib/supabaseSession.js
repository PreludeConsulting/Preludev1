/**
 * Maps a Supabase session + profile into the app user shape used by AuthContext
 * and the dashboard (matches attachFrontendFields from auth.js).
 */

import { getPlan } from "./plans.js";
import { ONBOARDING_STATUS } from "./onboardingRoutes.js";
import { mapOnboardingToUserFields } from "./preludeMatchService.js";

export function mapSupabaseUser(session, profile = null, onboarding = null, hasAssignedMentor = false) {
  if (!session?.user) return null;
  const u = session.user;
  const meta = u.user_metadata || {};
  const fullName = (profile?.full_name || meta.full_name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const role = (profile?.role || meta.role || "student").toLowerCase();
  const cachedPlan = typeof window !== "undefined" ? window.localStorage.getItem(`prelude_plan_${u.id}`) : null;
  const planId = profile?.plan_id || cachedPlan || null;
  const plan = planId ? getPlan(planId) : null;
  const onboardingFields = mapOnboardingToUserFields(onboarding, hasAssignedMentor);

  let onboardingStatus = onboardingFields.onboardingStatus;
  if (!planId) onboardingStatus = ONBOARDING_STATUS.NEEDS_PLAN;
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
    emailVerified: Boolean(u.email_confirmed_at || session),
    authProvider: "supabase",
    avatarUrl: profile?.avatar_url || null,
    ...onboardingFields,
    onboardingStatus
  };
}
