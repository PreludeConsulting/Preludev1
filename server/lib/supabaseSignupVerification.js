import {
  buildSignupVerificationEmailUrl,
  normalizeGenerateLinkProperties
} from "../../shared/authRecoveryLink.js";
import { buildAuthUrl, deliverAuthEmail } from "./authEmail.js";
import { createSupabaseAdmin, normalizeResetEmail } from "./supabasePasswordReset.js";

/**
 * Generate a Supabase signup confirmation link and deliver it through Prelude's Resend pipeline.
 */
export async function sendSupabaseSignupVerificationEmail({
  email,
  req,
  env = process.env,
  redirectPath = "/verify-email"
}) {
  const admin = createSupabaseAdmin(env);
  if (!admin) {
    return { delivered: false, reason: "missing_supabase_admin" };
  }

  const normalizedEmail = normalizeResetEmail(email);
  if (!normalizedEmail) {
    return { delivered: false, reason: "missing_email" };
  }

  const redirectTo = buildAuthUrl(req, redirectPath, env);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: normalizedEmail,
    options: { redirectTo }
  });

  if (error) {
    console.info("[prelude-auth] signup_verification_skipped", {
      email: normalizedEmail,
      reason: error.message
    });
    return { delivered: false, reason: "generate_link_failed", accountUnknown: true };
  }

  const appOrigin = new URL(redirectTo).origin;
  const verifyUrl = buildSignupVerificationEmailUrl(appOrigin, normalizeGenerateLinkProperties(data));
  if (!verifyUrl) {
    console.error("[prelude-auth] signup_verification_missing_direct_link", {
      email: normalizedEmail,
      hasProperties: Boolean(data?.properties),
      hasHashedToken: Boolean(data?.properties?.hashed_token),
      hasActionLink: Boolean(data?.properties?.action_link)
    });
    return { delivered: false, reason: "missing_direct_verify_link" };
  }

  const delivery = await deliverAuthEmail({
    kind: "verify-email",
    to: normalizedEmail,
    url: verifyUrl,
    req,
    env
  });

  return {
    delivered: Boolean(delivery.delivered),
    reason: delivery.reason || null,
    logged: Boolean(delivery.logged),
    devOnly: Boolean(delivery.devOnly)
  };
}
