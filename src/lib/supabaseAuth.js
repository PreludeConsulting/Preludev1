/**
 * Supabase authentication helpers (optional parallel auth stack).
 *
 * These wrap Supabase Auth and return user-friendly results. They are used by
 * the pages under `/auth/*` only and do NOT replace the existing Prisma/JWT
 * auth in src/lib/auth.js.
 *
 * Role security note: the user-selectable roles are limited to "student" and
 * "mentor" here, but the REAL guarantee lives in the database (RLS policy +
 * trigger in supabase/setup-auth.sql). Never trust the frontend for role
 * enforcement.
 */

import { supabase } from "./supabase.js";
import { appPath } from "./appPaths.js";

export const SELECTABLE_ROLES = ["student", "mentor"];

function fullUrl(path) {
  // Build an absolute URL that includes the Vite base (e.g. /Preludev1/...).
  return `${window.location.origin}${appPath(path)}`;
}

/** Map raw Supabase/network errors to friendlier copy where we can. */
function friendlyError(error) {
  if (!error) return null;
  const message = (error.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "That email or password doesn't match our records.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (message.includes("password should be at least")) {
    return "Please choose a longer password (at least 6 characters).";
  }
  if (message.includes("inactive recipient")) {
    return "Supabase couldn't email this address. For local testing, disable email confirmation in the Supabase dashboard or use a different email. See SUPABASE_AUTH_SETUP.md.";
  }
  if (message.includes("for security purposes") || message.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("failed to fetch")) {
    return "Couldn't reach Supabase. Check your connection and VITE_SUPABASE_URL.";
  }
  return error.message || "Something went wrong. Please try again.";
}

/**
 * Create a Supabase Auth account.
 * full_name and role are stored in Auth metadata; the database trigger
 * (handle_new_user) creates the matching public.profiles row.
 *
 * @param {{ email: string, password: string, fullName: string, role?: string }} params
 */
export async function signUp({ email, password, fullName, role = "student" }) {
  const safeRole = SELECTABLE_ROLES.includes(role) ? role : "student";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: safeRole },
      emailRedirectTo: fullUrl("/auth/login")
    }
  });

  if (error) return { data: null, error: friendlyError(error) };

  // If email confirmation is enabled, there is no active session yet.
  const needsEmailConfirmation = Boolean(data?.user && !data?.session);
  return { data, error: null, needsEmailConfirmation };
}

/** @param {{ email: string, password: string }} params */
export async function logIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error: friendlyError(error) };
  return { data, error: null };
}

export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { error: friendlyError(error) };
  return { error: null };
}

/** Returns the current session (or null) without throwing. */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error: friendlyError(error) };
  return { session: data.session, error: null };
}

/** Sends a password reset email that links back to /auth/reset-password. */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: fullUrl("/auth/reset-password")
  });
  if (error) return { error: friendlyError(error) };
  return { error: null };
}

/** Sets a new password (used after following the reset link). */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { data: null, error: friendlyError(error) };
  return { data, error: null };
}

/** Fetch the current user's profile row (if the table/policies exist). */
export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return { profile: null, error: friendlyError(error) };
  return { profile: data, error: null };
}
