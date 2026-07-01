import { createClient } from "@supabase/supabase-js";
import { buildPasswordResetEmailUrl } from "../../shared/authRecoveryLink.js";
import { buildAuthUrl, deliverAuthEmail } from "./authEmail.js";

export function normalizeResetEmail(email) {
  return (email || "").trim().toLowerCase();
}

export function createSupabaseAdmin(env = process.env) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function createSupabaseUserClient(accessToken, env = process.env) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim();
  const anonKey = (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !anonKey || !accessToken) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export async function resolvePasswordResetEmail({ requestedEmail, accessToken, env = process.env }) {
  const normalizedRequested = normalizeResetEmail(requestedEmail);
  if (!accessToken) return normalizedRequested;

  const client = createSupabaseUserClient(accessToken, env);
  if (!client) return normalizedRequested;

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user?.email) return normalizedRequested;

  const sessionEmail = normalizeResetEmail(data.user.email);
  if (normalizedRequested && normalizedRequested !== sessionEmail) {
    const mismatch = new Error("You can only reset the password for your signed-in account.");
    mismatch.statusCode = 400;
    mismatch.code = "email_mismatch";
    throw mismatch;
  }
  return sessionEmail;
}

/**
 * Generate a Supabase recovery link and deliver it through Prelude's Resend pipeline.
 */
export async function sendSupabasePasswordResetEmail({ email, req, env = process.env, redirectPath = "/reset-password" }) {
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
    type: "recovery",
    email: normalizedEmail,
    options: { redirectTo }
  });

  if (error) {
    console.info("[prelude-auth] password_reset_link_skipped", {
      email: normalizedEmail,
      reason: error.message
    });
    return { delivered: false, reason: "generate_link_failed", accountUnknown: true };
  }

  const appOrigin = new URL(redirectTo).origin;
  const resetUrl = buildPasswordResetEmailUrl(appOrigin, data?.properties);
  if (!resetUrl) {
    console.error("[prelude-auth] password_reset_missing_action_link", { email: normalizedEmail });
    return { delivered: false, reason: "missing_action_link" };
  }

  const delivery = await deliverAuthEmail({
    kind: "password-reset",
    to: normalizedEmail,
    url: resetUrl,
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
