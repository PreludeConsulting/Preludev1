/**
 * Auth persistence helpers — keep confirmed Supabase sessions usable across
 * refresh, Stripe returns, and onboarding without re-prompting OTP.
 */

export function isConfirmedAppUser(user) {
  return Boolean(user?.emailVerified ?? user?.email_confirmed_at ?? user?.confirmed_at);
}

/**
 * Route-guard OTP step-up is only for a fresh password/OAuth login on an
 * untrusted device — never for session restore, refresh, or navigation.
 */
export function needsLoginStepUpVerification({ user, loginVerified, pendingLoginStepUp = false }) {
  if (!user) return false;
  if (!isConfirmedAppUser(user)) return false;
  if (loginVerified) return false;
  return Boolean(pendingLoginStepUp);
}

export function needsEmailConfirmation({ user }) {
  return Boolean(user && !isConfirmedAppUser(user));
}

/**
 * After bootstrap / token refresh, a confirmed session is enough for app access.
 * Failures talking to the assurance API must not clear a restored session.
 */
export function resolveRestoredLoginVerified({
  user,
  pendingLoginStepUp = false,
  assuranceVerified = null,
  assuranceError = null
}) {
  if (!user) return false;
  if (!isConfirmedAppUser(user)) return false;
  if (pendingLoginStepUp) {
    if (assuranceError) return false;
    return Boolean(assuranceVerified);
  }
  // Confirmed restored session: stay signed in even if assurance API is down.
  if (assuranceError) return true;
  if (assuranceVerified === false) return true;
  return true;
}

export function shouldFailOpenLoginVerification(error) {
  const code = error?.payload?.error || error?.code || "";
  const status = error?.status || error?.statusCode || 0;
  return (
    code === "login_verification_storage_missing" ||
    code === "login_verification_unavailable" ||
    code === "login_verification_not_configured" ||
    code === "html_response" ||
    status === 503 ||
    status === 502 ||
    status === 0
  );
}
