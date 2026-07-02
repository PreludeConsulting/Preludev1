/** Generic copy shown after a password reset request — never reveals whether the email exists. */
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists with this email, a password reset link has been sent.";

/** Legacy Prisma/JWT reset tokens expire after this many minutes. */
export const LEGACY_RESET_TOKEN_MINUTES = 30;

/** Shown in password-reset emails; Supabase recovery links use the project OTP expiry (configure 15–60 min). */
export const PASSWORD_RESET_LINK_EXPIRY_MINUTES = 60;
