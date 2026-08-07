/**
 * Maps a Supabase session + profile into the app user shape used by AuthContext
 * and the dashboard (matches attachFrontendFields from auth.js).
 */

import { getPlan, normalizePlanId } from "./plans.js";
import { ONBOARDING_STATUS } from "./onboardingRoutes.js";
import { mapOnboardingToUserFields } from "./preludeMatchService.js";
import { normalizeAuthProviders } from "./authSignInMethod.js";
import { resolveAvatarUrl } from "./avatar.js";
import { hasMatchingTeamAccess } from "../../shared/matchingTeamAccess.js";

export function isSupabaseUserConfirmed(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

export function mapSupabaseUser(
  session,
  profile = null,
  onboarding = null,
  hasAssignedMentor = false,
  mentorQuestionnaire = null,
  options = {}
) {
  if (!session?.user) return null;
  const u = session.user;
  const meta = u.user_metadata || {};
  const preferredName = (profile?.preferred_name || "").trim();
  const fullName = (profile?.full_name || meta.full_name || "").trim();
  const oauthAvatarUrl = (meta.avatar_url || meta.picture || "").trim() || null;
  const avatarUrl = resolveAvatarUrl({
    profile,
    user: { avatarUrl: profile?.avatar_url, oauthAvatarUrl },
    oauthAvatarUrl
  }) || null;
  const [firstFromFull, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const preferredFirst = preferredName.split(/\s+/).filter(Boolean)[0] || preferredName || "";
  const firstName = preferredFirst || firstFromFull || "";
  const lastName = rest.join(" ") || "";
  const storedRole = (profile?.role || meta.role || "student").toLowerCase();
  const metadataRole = (meta.role || "").toLowerCase();
  const matchingTeamAccess =
    Boolean(options.matchingTeamAccess) ||
    hasMatchingTeamAccess({
      ...profile,
      systemRole: storedRole,
      role: storedRole
    });
  const role = matchingTeamAccess
    ? (
      ["student", "mentor", "parent"].includes(metadataRole)
        ? metadataRole
        : mentorQuestionnaire
          ? "mentor"
          : "mentor"
    )
    : storedRole;
  // Access gating uses DB fields only — localStorage is UX cache, never entitlement truth.
  const planId = normalizePlanId(profile?.plan_id || null);
  const plan = planId ? getPlan(planId) : null;
  const onboardingFields = mapOnboardingToUserFields(onboarding, hasAssignedMentor);
  const parentInviteStepComplete = Boolean(onboardingFields.parentInviteStepComplete);
  const paymentStepComplete =
    Boolean(onboardingFields.paymentStepComplete) || Boolean(profile?.payment_waived);
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
    firstName: firstName || "",
    lastName: lastName || "",
    preferredName: preferredName || "",
    name: fullName || preferredName || u.email || "",
    role,
    systemRole: storedRole,
    matchingTeamAccess,
    isMatchingTeam: matchingTeamAccess,
    plan: planId,
    planName: plan?.name || null,
    planSelected,
    paymentStepComplete,
    subscriptionStatus: profile?.subscription_status || null,
    subscriptionCurrentPeriodEnd: profile?.subscription_current_period_end || null,
    subscriptionCancelAtPeriodEnd: Boolean(profile?.subscription_cancel_at_period_end),
    paymentWaived: Boolean(profile?.payment_waived),
    promoCampaign: profile?.promo_campaign || null,
    promoAccessEndsAt: profile?.promo_access_ends_at || null,
    // Auth user confirmation is authoritative; profile.email may legitimately be null.
    emailVerified: isSupabaseUserConfirmed(u),
    authProvider: "supabase",
    authSignInMethods,
    avatarUrl,
    oauthAvatarUrl,
    roleSelectionComplete,
    createdAt: u.created_at || null,
    ...onboardingFields,
    parentInviteStepComplete,
    mentorOnboardingComplete: role === "mentor" ? Boolean(mentorQuestionnaire?.completed) : true,
    onboardingStatus
  };
}
