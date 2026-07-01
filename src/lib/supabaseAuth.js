/**
 * Supabase authentication helpers — used by /login, /register, and AuthContext
 * when VITE_SUPABASE_* env vars are set.
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase.js";
import { appPath } from "./appPaths.js";
import { sanitizeAuthRedirect } from "./authRedirects.js";
import { getPublicAppUrl, getSupabaseConfigError, isSupabaseConfigured } from "./supabaseConfig.js";
import { mapSupabaseUser } from "./supabaseSession.js";
import { captchaOptions, requireTurnstileToken } from "./turnstile.js";
import {
  clearLocalUserData,
  clearPendingOAuthAccountDeletion,
  clearSupabaseAuthStorage,
  readPendingOAuthAccountDeletion,
  storePendingOAuthAccountDeletion
} from "./accountDeletionFlow.js";
import { primaryOAuthProvider } from "./authSignInMethod.js";
import { isOAuthAvatarUrl } from "./avatar.js";
import {
  interpretPasswordSamenessCheck,
  SAME_PASSWORD_RESET_MESSAGE
} from "../../shared/passwordSameness.js";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "../../shared/passwordResetConstants.js";
import {
  SIGNUP_VERIFICATION_GENERIC_MESSAGE,
  SIGNUP_VERIFICATION_SENT_MESSAGE
} from "../../shared/signupVerificationConstants.js";

export const SELECTABLE_ROLES = ["student", "mentor", "parent"];
const OAUTH_PROVIDERS = ["google"];
const callbackRequests = new Map();
const verificationRequests = new Map();
const recoveryRequests = new Map();
const AUTH_REQUEST_TIMEOUT_MS = 18000;

function authDebug(event, details = {}) {
  if (!import.meta.env.DEV) return;
  const safeDetails = {};
  for (const [key, value] of Object.entries(details)) {
    if (/password|token|secret|key/i.test(key)) continue;
    safeDetails[key] = value;
  }
  console.info(`[prelude-auth] ${event}`, safeDetails);
}

function fullUrl(path) {
  const origin = getPublicAppUrl() || window.location.origin;
  return `${origin}${appPath(path)}`;
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function safeOAuthMetadata(user) {
  const meta = user?.user_metadata || {};
  return {
    fullName: (meta.full_name || meta.name || "").trim(),
    avatarUrl: (meta.avatar_url || meta.picture || "").trim(),
    email: normalizeEmail(user?.email)
  };
}

export function getAuthCallbackUrl(next = "") {
  const safeNext = sanitizeAuthRedirect(next || "/dashboard", "/dashboard");
  const query = `?next=${encodeURIComponent(safeNext)}`;
  return fullUrl(`/auth/callback${query}`);
}

async function setSessionFromHashIfPresent(supabase, hashParams) {
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (!accessToken || !refreshToken) return { usedHashSession: false, error: null };
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  return { usedHashSession: true, error };
}

function callbackKey(prefix, search = "", hash = "") {
  const searchParams = new URLSearchParams(search || "");
  const hashParams = new URLSearchParams((hash || "").replace(/^#/, ""));
  return [
    prefix,
    searchParams.get("code") || "",
    searchParams.get("token_hash") || hashParams.get("token_hash") || "",
    searchParams.get("type") || hashParams.get("type") || "",
    Boolean(hashParams.get("access_token"))
  ].join(":");
}

function runSingleFlight(map, key, task) {
  if (map.has(key)) return map.get(key);
  const promise = task().finally(() => {
    const schedule = typeof window !== "undefined" ? window.setTimeout.bind(window) : setTimeout;
    schedule(() => map.delete(key), 5000);
  });
  map.set(key, promise);
  return promise;
}

function withAuthTimeout(promise, message = "Prelude could not reach Supabase. Check your connection and try again.") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), AUTH_REQUEST_TIMEOUT_MS);
    })
  ]);
}

export function friendlyAuthError(error) {
  if (!error) return null;
  const message = (error.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "That email or password doesn't match our records.";
  }
  if (message.includes("captcha") || message.includes("security check")) {
    return "The security check could not be verified. Please complete it again.";
  }
  if (message.includes("otp") || message.includes("token") || message.includes("expired") || message.includes("invalid_grant")) {
    return "This secure link is invalid or expired. Request a new link and try again.";
  }
  if (message.includes("same password") || message.includes("different from the old password")) {
    return "Choose a new password that is different from your current password.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (message.includes("already confirmed")) {
    return "This email is already confirmed. Log in or use forgot password if you need help signing in.";
  }
  if (message.includes("unable to validate email") || message.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("password should be at least")) {
    return "Please choose a longer password (at least 6 characters).";
  }
  if (message.includes("weak password") || message.includes("password")) {
    return "Please choose a stronger password.";
  }
  if (message.includes("inactive recipient") || message.includes("smtp") || message.includes("email rate limit exceeded")) {
    return "We couldn't send that email right now. Please wait a moment and try again.";
  }
  if (message.includes("redirect") || message.includes("not allowed")) {
    return "This auth redirect is not allowed yet. Check the Supabase redirect URL allow list.";
  }
  if (message.includes("provider") || message.includes("oauth")) {
    return "Google sign-in is not enabled or its redirect settings do not match. Check Supabase and Google Cloud OAuth settings.";
  }
  if (message.includes("invalid api key") || message.includes("project not found") || message.includes("jwt")) {
    return "Supabase rejected the public auth configuration. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.";
  }
  if (message.includes("for security purposes") || message.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("failed to fetch")) {
    return "Couldn't reach Supabase. Check your connection and VITE_SUPABASE_URL.";
  }
  if (message.includes("please complete account role selection")) {
    return "We couldn't update your profile yet. Please choose your account role and try again.";
  }
  if (message.includes("duplicate key") || message.includes("unique constraint")) {
    return "Your account setup could not be restored, so we restarted it safely.";
  }
  if (message.includes("profile") && message.includes("permission")) {
    return "We couldn't create your profile. Please refresh or try again.";
  }
  const fallback = error.message || "Something went wrong. Please try again.";
  if (import.meta.env.PROD) return "Something went wrong. Please try again.";
  return fallback;
}

const friendlyError = friendlyAuthError;

function friendlyPasswordSignInError(error) {
  const message = (error?.message || "").toLowerCase();
  if (message.includes("invalid_grant") || message.includes("invalid login credentials")) {
    return "That email or password doesn't match our records.";
  }
  return friendlyError(error);
}

export function friendlyProviderError(rawError = "") {
  const message = String(rawError || "").toLowerCase();
  if (!message) return "We couldn't finish signing you in. Please try again.";
  if (message.includes("otp_expired") || message.includes("invalid or has expired") || message.includes("email link is invalid")) {
    return "This password reset link has expired or was already used. Request a new reset email.";
  }
  if (message.includes("access_denied") || message.includes("denied") || message.includes("cancel")) {
    return "Google sign-in was canceled.";
  }
  if (message.includes("expired") || message.includes("invalid") || message.includes("token")) {
    return "This secure link is invalid or expired. Request a new link and try again.";
  }
  if (message.includes("rate") || message.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("redirect")) {
    return "This auth redirect is not allowed yet. Check the Supabase redirect URL allow list.";
  }
  return import.meta.env.PROD ? "We couldn't finish signing you in. Please try again." : rawError;
}

export async function signUp({ email, password, fullName, role, captchaToken }) {
  if (!isSupabaseConfigured()) {
    return { user: null, error: getSupabaseConfigError() || "Supabase is not configured for this deployment.", needsEmailConfirmation: false };
  }
  const safeRole = SELECTABLE_ROLES.includes(role) ? role : null;
  if (!safeRole) {
    return { user: null, error: "Please choose Student, Mentor, or Parent.", needsEmailConfirmation: false };
  }
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: "Supabase client unavailable.", needsEmailConfirmation: false };
  requireTurnstileToken(captchaToken);

  const normalizedEmail = normalizeEmail(email);
  const emailRedirectTo = fullUrl("/verify-email");
  authDebug("signup_started", { email: normalizedEmail, role: safeRole, emailRedirectTo });

  const { data, error } = await withAuthTimeout(
    supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          email: normalizedEmail,
          role: safeRole,
          role_selection_complete: true
        },
        emailRedirectTo,
        ...captchaOptions(captchaToken)
      }
    })
  );

  authDebug("signup_response_received", {
    hasUser: Boolean(data?.user),
    hasSession: Boolean(data?.session),
    error: error?.message || null
  });

  if (error) return { user: null, error: friendlyError(error), rawError: error.message, needsEmailConfirmation: false };

  const needsEmailConfirmation = Boolean(data?.user && !data?.session);
  if (needsEmailConfirmation) {
    const delivery = await requestSignupVerificationEmail(normalizedEmail, captchaToken);
    authDebug("signup_verification_email_requested", {
      email: normalizedEmail,
      delivered: !delivery.error
    });
  }
  let profile = null;
  if (data?.session?.user) {
    const result = await ensureUserProfile(data.session.user, {
      fullName,
      email: normalizedEmail,
      role: safeRole,
      roleSelectionComplete: true
    });
    profile = result.profile;
  }
  const user = data?.session ? mapSupabaseUser(data.session, profile) : null;
  return {
    user,
    userId: data?.user?.id || null,
    error: null,
    needsEmailConfirmation,
    verificationEmailSent: needsEmailConfirmation
  };
}

async function requestSignupVerificationEmail(email, captchaToken) {
  try {
    const response = await withAuthTimeout(
      fetch(appPath("/api/auth/send-signup-verification"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: normalizeEmail(email),
          captchaToken: captchaToken || undefined
        })
      })
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        error: friendlyError({
          message: payload.message || "Could not send verification email."
        })
      };
    }
    return {
      error: null,
      message: payload.message || SIGNUP_VERIFICATION_GENERIC_MESSAGE
    };
  } catch (error) {
    return { error: friendlyError(error) };
  }
}

export async function signInWithOAuth(provider = "google", options = {}) {
  if (!isSupabaseConfigured()) return { url: null, error: "Supabase is not configured for this deployment." };
  const safeProvider = OAUTH_PROVIDERS.includes(provider) ? provider : null;
  if (!safeProvider) return { url: null, error: "That sign-in provider is not supported yet." };
  const supabase = getSupabase();
  if (!supabase) return { url: null, error: "Supabase client unavailable." };

  const redirectTo = getAuthCallbackUrl(options.next);
  authDebug("oauth_redirect_started", { provider: safeProvider, redirectTo });
  const { data, error } = await withAuthTimeout(
    supabase.auth.signInWithOAuth({
      provider: safeProvider,
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  );

  if (error) return { url: null, error: friendlyError(error) };
  return { url: data?.url || null, error: data?.url ? null : "Google sign-in did not return a redirect URL." };
}

export async function logIn({ email, password, captchaToken }) {
  if (!isSupabaseConfigured()) return { user: null, error: "Supabase is not configured for this deployment." };
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: "Supabase client unavailable." };
  requireTurnstileToken(captchaToken);
  const { data, error } = await withAuthTimeout(
    supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaOptions(captchaToken)
    })
  );
  if (error) return { user: null, error: friendlyPasswordSignInError(error) };
  const { profile } = await getProfile(data.user.id);
  return { user: mapSupabaseUser(data.session, profile), error: null };
}

export async function saveUserRoleSelection(userId, role) {
  const safeRole = SELECTABLE_ROLES.includes(role) ? role : null;
  if (!safeRole) return { error: "Please choose Student, Mentor, or Parent." };
  if (!userId) return { error: "You must be signed in to choose a role." };

  const { error } = await getSupabase()
    .from("profiles")
    .update({
      role: safeRole,
      role_selection_complete: true
    })
    .eq("id", userId);

  if (error) {
    if (/role_selection_complete|column/i.test(error.message || "")) {
      return {
        error: "Role selection is not enabled in Supabase yet. Run the latest setup-dashboard-data.sql or migration."
      };
    }
    return { error: friendlyError(error) };
  }

  const roleProfileTable = safeRole === "mentor" ? "mentor_profiles" : safeRole === "student" ? "student_profiles" : null;
  if (roleProfileTable) {
    const { error: profileError } = await getSupabase()
      .from(roleProfileTable)
      .upsert({ user_id: userId }, { onConflict: "user_id" });
    if (profileError && !/relation|schema cache|does not exist/i.test(profileError.message || "")) {
      return { error: friendlyError(profileError) };
    }
  }

  return { error: null };
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

export async function resetPassword(email, captchaToken, options = {}) {
  if (!options.skipCaptcha) requireTurnstileToken(captchaToken);
  const normalizedEmail = normalizeEmail(email);
  authDebug("password_reset_request_started", { email: normalizedEmail });

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  const { session } = await getCurrentSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  try {
    const response = await withAuthTimeout(
      fetch(appPath("/api/auth/request-password-reset"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          email: normalizedEmail,
          captchaToken: captchaToken || undefined
        })
      })
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      return { error: null, message: payload.message || PASSWORD_RESET_GENERIC_MESSAGE };
    }
    if (payload.error !== "password_reset_unavailable") {
      return { error: friendlyError({ message: payload.message || "Could not send password reset email." }) };
    }
  } catch (error) {
    if (!import.meta.env.DEV) {
      return { error: friendlyError(error) };
    }
    authDebug("password_reset_api_unavailable", { message: error?.message || "request_failed" });
  }

  if (import.meta.env.PROD) {
    return {
      error: friendlyError({
        message: "We couldn't send a password reset email right now. Please try again in a moment."
      })
    };
  }

  const redirectTo = fullUrl("/reset-password");
  authDebug("password_reset_fallback_to_supabase", { email: normalizedEmail, redirectTo });
  const { error } = await withAuthTimeout(
    getSupabase().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
      ...captchaOptions(captchaToken)
    })
  );
  if (error) return { error: friendlyError(error) };
  return { error: null, message: PASSWORD_RESET_GENERIC_MESSAGE };
}

/**
 * During recovery, probe whether the candidate password already works for this account.
 * Uses an ephemeral client so the recovery session is not disturbed.
 */
export async function assertNewPasswordDiffersFromCurrent(email, newPassword) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !newPassword) return { error: null };

  const tempClient = createEphemeralSupabaseClient();
  if (!tempClient) return { error: null };

  const { data, error } = await withAuthTimeout(
    tempClient.auth.signInWithPassword({ email: normalizedEmail, password: newPassword })
  );

  const interpretation = interpretPasswordSamenessCheck({
    hasSession: Boolean(data?.session),
    errorMessage: error?.message
  });

  if (data?.session) {
    await tempClient.auth.signOut();
  }

  if (interpretation.sameAsCurrent) {
    return { error: SAME_PASSWORD_RESET_MESSAGE };
  }

  return { error: null };
}

export async function resendSignupConfirmation(email) {
  if (!isSupabaseConfigured()) {
    throw new Error(getSupabaseConfigError() || "Supabase is not configured for this deployment.");
  }

  const normalizedEmail = normalizeEmail(email);
  authDebug("resend_confirmation_started", { email: normalizedEmail });
  const result = await requestSignupVerificationEmail(normalizedEmail);
  authDebug("resend_confirmation_response_received", {
    email: normalizedEmail,
    error: result.error || null
  });
  if (result.error) throw new Error(result.error);
  return { message: SIGNUP_VERIFICATION_SENT_MESSAGE };
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

export async function verifySupabasePassword({ email, password, captchaToken }) {
  const tempClient = createEphemeralSupabaseClient();
  if (!tempClient) throw new Error("Supabase client unavailable.");
  requireTurnstileToken(captchaToken);

  const { data, error } = await tempClient.auth.signInWithPassword({
    email,
    password,
    options: captchaOptions(captchaToken)
  });
  if (error || !data?.session) {
    throw new Error(friendlyPasswordSignInError(error) || "That email or password doesn't match our records.");
  }

  await tempClient.auth.signOut();
  return data;
}

async function assertActiveSupabaseSession(email) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase client unavailable.");

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Could not verify your session.");
  if ((user.email || "").toLowerCase() !== (email || "").toLowerCase()) {
    throw new Error("Session mismatch. Please sign in again and retry.");
  }
  return { supabase, user };
}

async function executeSupabaseAccountDeletion(email) {
  const { supabase, user } = await assertActiveSupabaseSession(email);
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

  clearLocalUserData(user.id, user.email);
  clearPendingOAuthAccountDeletion();
  clearSupabaseAuthStorage();
  await supabase.auth.signOut();
  return { message: "Your account has been permanently deleted." };
}

export async function startOAuthAccountDeletionReauth({ user, returnPath }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Google verification requires Supabase authentication.");
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase client unavailable.");
  if (!user?.id || !user?.email) throw new Error("You must be signed in to delete your account.");

  const provider = primaryOAuthProvider(user.authSignInMethods || []);
  const origin = getPublicAppUrl() || window.location.origin;
  const redirectTo = `${origin}${appPath(returnPath || window.location.pathname)}`;

  storePendingOAuthAccountDeletion({
    userId: user.id,
    email: user.email,
    returnPath: returnPath || window.location.pathname,
    provider
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "login"
      }
    }
  });

  if (error) throw new Error(friendlyError(error) || "Google verification could not be started.");
  if (!data?.url) throw new Error("Google verification did not return a redirect URL.");

  window.location.assign(data.url);
  return { redirecting: true };
}

export async function completePendingOAuthAccountDeletion() {
  const pending = readPendingOAuthAccountDeletion();
  if (!pending) return { completed: false };

  const { supabase, user } = await assertActiveSupabaseSession(pending.email);
  if (user.id !== pending.userId) {
    clearPendingOAuthAccountDeletion();
    throw new Error("Google verification did not match your account. Account was not deleted.");
  }

  const result = await executeSupabaseAccountDeletion(pending.email);
  return { completed: true, ...result };
}

export async function deleteSupabaseAccount({ email, password, confirmPassword, captchaToken }) {
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  await verifySupabasePassword({ email, password, captchaToken });
  return executeSupabaseAccountDeletion(email);
}

export async function deleteSupabaseAccountAfterOAuth() {
  const pending = readPendingOAuthAccountDeletion();
  if (!pending) {
    throw new Error("Google verification expired. Start account deletion again.");
  }
  return completePendingOAuthAccountDeletion();
}

export async function updatePassword(newPassword) {
  const { data, error } = await withAuthTimeout(getSupabase().auth.updateUser({ password: newPassword }));
  if (error) return { data: null, error: friendlyError(error) };
  return { data, error: null };
}

/** Set a new password from a recovery session, then end the temporary session. */
export async function completePasswordReset(newPassword, options = {}) {
  const email = options.email || (await getCurrentSession()).session?.user?.email;
  const { error: samenessError } = await assertNewPasswordDiffersFromCurrent(email, newPassword);
  if (samenessError) return { error: samenessError };

  const { error: updateError } = await updatePassword(newPassword);
  if (updateError) return { error: updateError };
  await logOut();
  return { error: null };
}

export async function getProfile(userId) {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return { profile: null, error: friendlyError(error) };
  return { profile: data, error: null };
}

async function ensureDependentRecords(userId, role = "student") {
  const supabase = getSupabase();
  if (!supabase || !userId) return { error: null };

  const { data: onboardingRow } = await supabase
    .from("onboarding_progress")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const tasks = [supabase.from("user_settings").upsert({ user_id: userId }, { onConflict: "user_id" })];

  if (!onboardingRow) {
    tasks.push(
      supabase.from("onboarding_progress").insert({
        user_id: userId,
        onboarding_status: "needs_plan",
        updated_at: new Date().toISOString()
      })
    );
  }

  if (role === "student") {
    tasks.push(supabase.from("student_profiles").upsert({ user_id: userId }, { onConflict: "user_id" }));
  } else if (role === "mentor") {
    tasks.push(supabase.from("mentor_profiles").upsert({ user_id: userId }, { onConflict: "user_id" }));
  }

  const results = await Promise.all(tasks);
  const blocking = results.find((result) => {
    const message = result.error?.message || "";
    return result.error && !/relation|schema cache|does not exist|duplicate key/i.test(message);
  });
  if (blocking?.error) {
    return { error: friendlyError(blocking.error) };
  }
  return { error: null };
}

export async function ensureUserProfile(user, overrides = {}) {
  const supabase = getSupabase();
  if (!supabase || !user?.id) return { profile: null, error: "Supabase client unavailable." };

  const metadata = safeOAuthMetadata(user);
  const role = SELECTABLE_ROLES.includes(overrides.role) ? overrides.role : null;
  const existing = await getProfile(user.id);

  if (existing.profile) {
    const existingAvatar = isOAuthAvatarUrl(existing.profile.avatar_url) ? null : existing.profile.avatar_url;
    const update = {
      email: metadata.email || overrides.email || existing.profile.email || null,
      avatar_url: existingAvatar || overrides.avatarUrl || metadata.avatarUrl || existing.profile.avatar_url || null,
      full_name: existing.profile.full_name || overrides.fullName || metadata.fullName || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", user.id)
      .select("*")
      .maybeSingle();
    if (error) {
      authDebug("profile_update_failed", { userId: user.id, message: error.message });
      return { profile: existing.profile, error: friendlyError(error) };
    }
    await ensureDependentRecords(user.id, data?.role || existing.profile.role || "student");
    return { profile: data || existing.profile, error: null };
  }

  const payload = {
    id: user.id,
    email: overrides.email || metadata.email || null,
    full_name: overrides.fullName || metadata.fullName || null,
    avatar_url: overrides.avatarUrl || metadata.avatarUrl || null,
    role: role || "student",
    role_selection_complete: Boolean(overrides.roleSelectionComplete)
  };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) {
    authDebug("profile_upsert_failed", { userId: user.id, message: error.message });
    return { profile: null, error: "We couldn't create your profile. Please refresh or try again." };
  }
  await ensureDependentRecords(user.id, data?.role || payload.role);
  return { profile: data, error: null };
}

async function processAuthCallback(search, hash) {
  if (!isSupabaseConfigured()) return { user: null, error: getSupabaseConfigError() || "Supabase is not configured for this deployment." };
  const supabase = getSupabase();
  const searchParams = new URLSearchParams(search || "");
  const hashParams = new URLSearchParams((hash || "").replace(/^#/, ""));
  authDebug("auth_callback_parameters_detected", {
    hasCode: Boolean(searchParams.get("code")),
    hasError: Boolean(searchParams.get("error") || hashParams.get("error")),
    hasHashAccessToken: Boolean(hashParams.get("access_token")),
    next: searchParams.get("next") || ""
  });

  const providerError = searchParams.get("error_description") || searchParams.get("error") || hashParams.get("error_description") || hashParams.get("error");
  if (providerError) return { user: null, error: friendlyProviderError(providerError) };

  const code = searchParams.get("code");
  let exchangedSession = null;
  if (code) {
    authDebug("callback_code_detected", { flow: "oauth" });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { user: null, error: friendlyError(error) };
    exchangedSession = data?.session || null;
  } else {
    const {
      data: { session: existingSession }
    } = await supabase.auth.getSession();
    if (!hashParams.get("access_token") && !existingSession) {
      return { user: null, error: "Missing OAuth authorization code." };
    }
    const { error } = await setSessionFromHashIfPresent(supabase, hashParams);
    if (error) return { user: null, error: friendlyError(error) };
  }

  const {
    data: { session: confirmedSession }
  } = await supabase.auth.getSession();
  if (!exchangedSession && !confirmedSession) {
    return { user: null, error: "Google login completed, but no Supabase session was created." };
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { user: null, error: friendlyError(userError) || "This sign-in link is invalid or expired." };
  }
  authDebug("session_detected", { userId: user.id, email: normalizeEmail(user.email) });

  const { error: profileError } = await ensureUserProfile(user);
  if (profileError) return { user: null, error: profileError };
  const appUser = await resolveSupabaseAppUser();
  return { user: appUser, error: null };
}

export async function completeAuthCallback(search = window.location.search, hash = window.location.hash) {
  return runSingleFlight(callbackRequests, callbackKey("oauth", search, hash), () => processAuthCallback(search, hash));
}

async function processEmailVerification(search, hash) {
  if (!isSupabaseConfigured()) return { user: null, error: getSupabaseConfigError() || "Supabase is not configured for this deployment." };
  const supabase = getSupabase();
  const searchParams = new URLSearchParams(search || "");
  const hashParams = new URLSearchParams((hash || "").replace(/^#/, ""));
  authDebug("verify_email_parameters_detected", {
    hasCode: Boolean(searchParams.get("code")),
    hasTokenHash: Boolean(searchParams.get("token_hash") || hashParams.get("token_hash")),
    type: searchParams.get("type") || hashParams.get("type") || ""
  });

  const providerError = searchParams.get("error_description") || searchParams.get("error") || hashParams.get("error_description") || hashParams.get("error");
  if (providerError) return { user: null, error: friendlyProviderError(providerError) };

  const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
  const rawType = searchParams.get("type") || hashParams.get("type") || "signup";
  const type = rawType === "email" ? "signup" : rawType;
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return { user: null, error: friendlyError(error) };
  } else {
    const code = searchParams.get("code");
    if (code) {
      authDebug("callback_code_detected", { flow: "verify-email" });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { user: null, error: friendlyError(error) };
    } else {
      const { error } = await setSessionFromHashIfPresent(supabase, hashParams);
      if (error) return { user: null, error: friendlyError(error) };
    }
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { user: null, error: friendlyError(userError) || "This verification link is invalid or expired." };
  }
  authDebug("session_detected", { userId: user.id, email: normalizeEmail(user.email) });

  const { error: profileError } = await ensureUserProfile(user);
  if (profileError) return { user: null, error: profileError };
  const appUser = await resolveSupabaseAppUser();
  return { user: appUser, error: null };
}

export async function completeEmailVerification(search = window.location.search, hash = window.location.hash) {
  return runSingleFlight(verificationRequests, callbackKey("verify", search, hash), () => processEmailVerification(search, hash));
}

async function processPasswordRecovery(search, hash) {
  const supabase = getSupabase();
  if (!supabase) return { hasRecoverySession: false, error: "Supabase client unavailable.", email: null };
  const searchParams = new URLSearchParams(search || "");
  const hashParams = new URLSearchParams((hash || "").replace(/^#/, ""));
  authDebug("password_recovery_parameters_detected", {
    hasCode: Boolean(searchParams.get("code")),
    hasTokenHash: Boolean(searchParams.get("token_hash") || hashParams.get("token_hash")),
    type: searchParams.get("type") || hashParams.get("type") || "",
    hasHashAccessToken: Boolean(hashParams.get("access_token"))
  });
  const providerError =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    searchParams.get("error_code") ||
    hashParams.get("error_description") ||
    hashParams.get("error") ||
    hashParams.get("error_code");
  if (providerError) return { hasRecoverySession: false, error: friendlyProviderError(providerError), email: null };

  const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
  const rawType = searchParams.get("type") || hashParams.get("type") || "recovery";
  const type = rawType === "email" ? "recovery" : rawType;

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return { hasRecoverySession: false, error: friendlyError(error), email: null };
  } else {
    const code = searchParams.get("code");
    if (code) {
      authDebug("callback_code_detected", { flow: "password-recovery" });
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { hasRecoverySession: false, error: friendlyError(error), email: null };
    } else {
      const { error } = await setSessionFromHashIfPresent(supabase, hashParams);
      if (error) return { hasRecoverySession: false, error: friendlyError(error), email: null };
    }
  }

  const { session, error } = await getCurrentSession();
  if (error) return { hasRecoverySession: false, error, email: null };

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const urlType = searchParams.get("type") || hashParams.get("type");
  const hasRecoverySession = Boolean(
    session && (type === "recovery" || urlType === "recovery" || searchParams.get("code") || hashParams.get("access_token"))
  );
  authDebug("password_recovery_session_detected", { hasRecoverySession, email: normalizeEmail(user?.email) });
  return { hasRecoverySession, error: null, email: user?.email ? normalizeEmail(user.email) : null };
}

export async function initializePasswordRecovery(search = window.location.search, hash = window.location.hash) {
  return runSingleFlight(recoveryRequests, callbackKey("recovery", search, hash), () => processPasswordRecovery(search, hash));
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

  const { error: onboardingError } = await getSupabase().from("onboarding_progress").upsert(
    { user_id: userId, onboarding_status: "needs_match", updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (onboardingError) {
    if (/onboarding_progress/i.test(onboardingError.message || "")) {
      return {
        error: "Plan saved, but onboarding progress could not be recorded. Run supabase/migrations/20260616000000_onboarding_progress.sql in Supabase."
      };
    }
    return { error: friendlyError(onboardingError) };
  }

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

  const {
    data: { user: authUser },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !authUser) return null;

  const userId = authUser.id;
  const { profile } = await ensureUserProfile(authUser);

  const [onboardingRes, mentorRes, mentorQuestionnaireRes] = await Promise.all([
    supabase.from("onboarding_progress").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("mentor_matches").select("id").eq("user_id", userId).eq("status", "assigned").limit(1),
    supabase.from("mentor_questionnaires").select("completed").eq("user_id", userId).maybeSingle()
  ]);

  const hasAssignedMentor = (mentorRes.data || []).length > 0;
  authDebug("profile_lookup_completed", {
    userId,
    hasProfile: Boolean(profile),
    hasOnboarding: Boolean(onboardingRes.data),
    hasAssignedMentor
  });
  const hydratedSession = { ...session, user: authUser };
  return mapSupabaseUser(hydratedSession, profile, onboardingRes.data, hasAssignedMentor, mentorQuestionnaireRes.data);
}
