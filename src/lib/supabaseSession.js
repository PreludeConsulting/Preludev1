/**
 * Maps a Supabase session + profile into the app user shape used by AuthContext
 * and the dashboard (matches attachFrontendFields from auth.js).
 */

import { getPlan, normalizePlanId } from "./plans.js";
import { ONBOARDING_STATUS } from "./onboardingRoutes.js";
import { mapOnboardingToUserFields } from "./preludeMatchService.js";
import { readPaymentStepComplete } from "./onboardingPayment.js";
import { readParentInviteStepComplete } from "./parentLinks.js";
import { normalizeAuthProviders } from "./authSignInMethod.js";
import { resolveAvatarUrl } from "./avatar.js";

export function mapSupabaseUser(session, profile = null, onboarding = null, hasAssignedMentor = false, mentorQuestionnaire = null) {
  if (!session?.user) return null;
  const u = session.user;
  const meta = u.user_metadata || {};
  const fullName = (profile?.full_name || meta.full_name || "").trim();
  const oauthAvatarUrl = (meta.avatar_url || meta.picture || "").trim() || null;
  const avatarUrl = resolveAvatarUrl({
    profile,
    user: { avatarUrl: profile?.avatar_url, oauthAvatarUrl },
    oauthAvatarUrl
  }) || null;
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const storedRole = (profile?.role || meta.role || "student").toLowerCase();
  const metadataRole = (meta.role || "").toLowerCase();
  const matchingTeamAccess = storedRole === "admin";
  const role = matchingTeamAccess
    ? (
      ["student", "mentor", "parent"].includes(metadataRole)
        ? metadataRole
        : mentorQuestionnaire
          ? "mentor"
          : "mentor"
    )
    : storedRole;
  const cachedPlan = typeof window !== "undefined" ? window.localStorage.getItem(`prelude_plan_${u.id}`) : null;
  const planId = normalizePlanId(profile?.plan_id || cachedPlan);
  const plan = planId ? getPlan(planId) : null;
  const onboardingFields = mapOnboardingToUserFields(onboarding, hasAssignedMentor);
  const parentInviteStepComplete =
    onboardingFields.parentInviteStepComplete || readParentInviteStepComplete(u.id);
  const paymentStepComplete =
    onboardingFields.paymentStepComplete || readPaymentStepComplete(u.id);
  const authSignInMethods = normalizeAuthProviders(u.identities || [], u);
  const roleSelectionComplete = profile?.role_selection_complete !== false;

  let onboardingStatus = onboardingFields.onboardingStatus;
  if (!roleSelectionComplete) {
    onboardingStatus = null;
  } else if (role === "parent") {
    onboardingStatus = ONBOARDING_STATUS.ONBOARDING_COMPLETED;
  } else if (!onboardingStatus) {
    onboardingStatus = ONBOARDING_STATUS.NEEDS_MATCH;
  }

  const planSelected = Boolean(planId && paymentStepComplete);

  return {
    id: u.id,
    email: u.email,
    firstName: firstName || "Student",
    lastName: rest.join(" ") || "User",
    name: fullName || u.email,
    role,
    systemRole: storedRole,
    matchingTeamAccess,
    plan: planId,
    planName: plan?.name || null,
    planSelected,
    paymentStepComplete,
    subscriptionStatus: profile?.subscription_status || null,
    emailVerified: Boolean(u.email_confirmed_at),
    authProvider: "supabase",
    authSignInMethods,
    avatarUrl,
    oauthAvatarUrl,
    roleSelectionComplete,
    ...onboardingFields,
    parentInviteStepComplete,
    paymentStepComplete,
    mentorOnboardingComplete: role === "mentor" ? Boolean(mentorQuestionnaire?.completed) : true,
    onboardingStatus
  };
}
