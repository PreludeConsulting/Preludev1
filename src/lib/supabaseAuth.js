/**
 * Supabase authentication helpers — used by /login, /register, and AuthContext
 * when VITE_SUPABASE_* env vars are set.
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase.js";
import { appPath } from "./appPaths.js";
import { getPublicAppOrigin, isSupabaseConfigured } from "./supabaseConfig.js";
import { mapSupabaseUser } from "./supabaseSession.js";

export const SELECTABLE_ROLES = ["student", "mentor"];

function fullUrl(path) {
  const origin = getPublicAppOrigin() || window.location.origin;
  return `${origin}${appPath(path)}`;
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
  if (!isSupabaseConfigured()) {
    return { user: null, error: "Supabase is not configured for this deployment.", needsEmailConfirmation: false };
  }
  const safeRole = SELECTABLE_ROLES.includes(role) ? role : "student";
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: "Supabase client unavailable.", needsEmailConfirmation: false };

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
  if (!isSupabaseConfigured()) return { user: null, error: "Supabase is not configured for this deployment." };
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: "Supabase client unavailable." };
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
  const supabase = getSupabase();
  if (!supabase) return { session: null, error: null };
  const { data, error } = await supabase.auth.getSession();
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

export async function resendSignupConfirmation(email) {
  if (!isSupabaseConfigured()) {
    return { message: "Supabase is not configured for this deployment." };
  }
  const supabase = getSupabase();
  if (!supabase) return { message: "Supabase client unavailable." };

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: fullUrl("/login") }
  });
  if (error) throw new Error(friendlyError(error));
  return { message: "Verification email sent. Check your inbox." };
}

function createEphemeralSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function verifySupabasePassword({ email, password }) {
  const tempClient = createEphemeralSupabaseClient();
  if (!tempClient) throw new Error("Supabase client unavailable.");

  const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw new Error(friendlyError(error) || "That email or password doesn't match our records.");
  }

  await tempClient.auth.signOut();
  return data;
}

export async function deleteSupabaseAccount({ email, password, confirmPassword, confirmationPhrase }) {
  const { DELETE_ACCOUNT_PHRASE } = await import("./accountDeletion.js");
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }
  if (confirmationPhrase !== DELETE_ACCOUNT_PHRASE) {
    throw new Error(`Type exactly: ${DELETE_ACCOUNT_PHRASE}`);
  }

  await verifySupabasePassword({ email, password });

  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase client unavailable.");

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Could not verify your session.");
  if ((user.email || "").toLowerCase() !== (email || "").toLowerCase()) {
    throw new Error("Session mismatch. Please sign in again and retry.");
  }

  const firstName = (user.user_metadata?.full_name || "User").split(/\s+/)[0];
  const userEmail = user.email || email;

  const { error: rpcError } = await supabase.rpc("delete_own_account");
  if (rpcError) {
    throw new Error(
      rpcError.message?.includes("function")
        ? "Account deletion is not enabled for this Supabase project yet. Ask an admin to run supabase/delete-account.sql."
        : friendlyError(rpcError)
    );
  }

  try {
    await fetch("/api/account/deleted-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, firstName })
    });
  } catch {
    /* email is best-effort for Supabase path */
  }

  await supabase.auth.signOut();
  return { message: "Your account has been permanently deleted." };
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

const PLAN_STORAGE_PREFIX = "prelude_plan_";

export function readCachedPlan(userId) {
  if (typeof window === "undefined" || !userId) return null;
  try {
    return window.localStorage.getItem(`${PLAN_STORAGE_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

function writeCachedPlan(userId, planId) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(`${PLAN_STORAGE_PREFIX}${userId}`, planId);
  } catch {
    /* storage unavailable */
  }
}

/** Persist the user's subscription plan choice (profile column + local fallback). */
export async function saveUserPlan(userId, planId) {
  if (!["basic", "plus", "pro"].includes(planId)) {
    return { error: "Please choose a valid plan." };
  }

  writeCachedPlan(userId, planId);

  const { error } = await getSupabase().from("profiles").update({ plan_id: planId }).eq("id", userId);
  if (error) {
    // Column may not exist yet if SQL migration wasn't re-run — local cache still works.
    if (/plan_id|column/.test(error.message || "")) {
      return { error: null, usedFallback: true };
    }
    return { error: friendlyError(error) };
  }

  await getSupabase().from("onboarding_progress").upsert(
    { user_id: userId, onboarding_status: "needs_match", updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return { error: null, usedFallback: false };
}

export function onAuthStateChange(callback) {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: { subscription: { unsubscribe() {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}

/** Load profile + onboarding + assigned mentor flag for AuthContext. */
export async function resolveSupabaseAppUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { session } = await getCurrentSession();
  if (!session) return null;
  const userId = session.user.id;
  const { profile } = await getProfile(userId);

  const [onboardingRes, mentorRes] = await Promise.all([
    supabase.from("onboarding_progress").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("mentor_matches").select("id").eq("user_id", userId).eq("status", "assigned").limit(1)
  ]);

  const hasAssignedMentor = (mentorRes.data || []).length > 0;
  return mapSupabaseUser(session, profile, onboardingRes.data, hasAssignedMentor);
}
