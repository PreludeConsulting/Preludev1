/**
 * Supabase authentication helpers — used by /login, /register, and AuthContext
 * when VITE_SUPABASE_* env vars are set.
 */

import { getSupabase } from "./supabase.js";
import { appPath } from "./appPaths.js";
import { mapSupabaseUser } from "./supabaseSession.js";

export const SELECTABLE_ROLES = ["student", "mentor"];

function fullUrl(path) {
  return `${window.location.origin}${appPath(path)}`;
}

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
    return "Supabase couldn't email this address. For local testing, disable email confirmation in the Supabase dashboard or use a different email.";
  }
  if (message.includes("for security purposes") || message.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("failed to fetch")) {
    return "Couldn't reach Supabase. Check your connection and VITE_SUPABASE_URL.";
  }
  return error.message || "Something went wrong. Please try again.";
}

export async function signUp({ email, password, fullName, role = "student" }) {
  const safeRole = SELECTABLE_ROLES.includes(role) ? role : "student";
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: safeRole },
      emailRedirectTo: fullUrl("/login")
    }
  });

  if (error) return { user: null, error: friendlyError(error), needsEmailConfirmation: false };

  const needsEmailConfirmation = Boolean(data?.user && !data?.session);
  let profile = null;
  if (data?.user) {
    const result = await getProfile(data.user.id);
    profile = result.profile;
  }
  const user = data?.session ? mapSupabaseUser(data.session, profile) : null;
  return { user, error: null, needsEmailConfirmation };
}

export async function logIn({ email, password }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { user: null, error: friendlyError(error) };
  const { profile } = await getProfile(data.user.id);
  return { user: mapSupabaseUser(data.session, profile), error: null };
}

export async function logOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) return { error: friendlyError(error) };
  return { error: null };
}

export async function getCurrentSession() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) return { session: null, error: friendlyError(error) };
  return { session: data.session, error: null };
}

export async function resetPassword(email) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: fullUrl("/reset-password")
  });
  if (error) return { error: friendlyError(error) };
  return { error: null };
}

export async function updatePassword(newPassword) {
  const { data, error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) return { data: null, error: friendlyError(error) };
  return { data, error: null };
}

export async function getProfile(userId) {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return { profile: null, error: friendlyError(error) };
  return { profile: data, error: null };
}

export function onAuthStateChange(callback) {
  return getSupabase().auth.onAuthStateChange(callback);
}

/** Load the current Supabase user for AuthContext, or null if signed out. */
export async function resolveSupabaseAppUser() {
  const { session } = await getCurrentSession();
  if (!session) return null;
  const { profile } = await getProfile(session.user.id);
  return mapSupabaseUser(session, profile);
}
