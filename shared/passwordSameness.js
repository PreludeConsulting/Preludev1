/**
 * Interprets the result of a password sign-in probe used during password reset.
 * If sign-in succeeds, the candidate password matches the current password.
 */
export function interpretPasswordSamenessCheck({ hasSession, errorMessage = "" } = {}) {
  if (hasSession) {
    return { sameAsCurrent: true, uncertain: false };
  }

  const message = String(errorMessage || "").toLowerCase();
  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid email or password") ||
    message.includes("invalid credentials")
  ) {
    return { sameAsCurrent: false, uncertain: false };
  }

  // OAuth-only or unknown auth state — allow reset without blocking.
  return { sameAsCurrent: false, uncertain: true };
}

export const SAME_PASSWORD_RESET_MESSAGE = "New password cannot be the same as your current password.";
