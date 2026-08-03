import { getPlan } from "./plans.js";
import { getSupabase } from "./supabase.js";

const DB_UNAVAILABLE_UI =
  "The local development database is unavailable. Start the database and try again.";

function sanitizeClientErrorMessage(payload, fallback) {
  if (payload?.error === "validation_error" && Array.isArray(payload.issues) && payload.issues.length) {
    return payload.issues.map((issue) => issue.message).filter(Boolean).join(" ") || "Please check your entries and try again.";
  }
  if (payload?.error === "database_unavailable") return payload.message || DB_UNAVAILABLE_UI;
  if (payload?.error === "email_unverified") {
    return payload.message || "Please verify your email before logging in. Check your inbox or use the development verification link from sign-up.";
  }
  const raw = payload?.message || fallback || "Request failed.";
  if (import.meta.env.PROD && /prisma|Can't reach database server/i.test(raw)) {
    return "Something went wrong. Please try again later.";
  }
  if (import.meta.env.DEV && /prisma|Can't reach database server/i.test(raw)) {
    return DB_UNAVAILABLE_UI;
  }
  return raw;
}

const CSRF_KEY = "prelude_csrf";
const LEGACY_SESSION_KEY = "prelude_session";

function readCookie(name) {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

function storeCsrf(token) {
  if (token) sessionStorage.setItem(CSRF_KEY, token);
}

export function getCsrfToken() {
  return sessionStorage.getItem(CSRF_KEY) || decodeURIComponent(readCookie("prelude_csrf") || "");
}

function isCsrfError(response, payload) {
  return response.status === 403 && /csrf token missing or invalid/i.test(payload?.message || "");
}

async function refreshCsrfToken() {
  const response = await fetch("/api/auth/me", { credentials: "include", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (payload.csrfToken) storeCsrf(payload.csrfToken);
  return response.ok && Boolean(payload.csrfToken);
}

export async function api(path, options = {}) {
  const { _csrfRetry, _sessionRefreshRetry, ...fetchOptions } = options;
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const csrf = getCsrfToken();
  if (csrf && !["GET", "HEAD", "OPTIONS"].includes(options.method || "GET")) headers["X-CSRF-Token"] = csrf;
  const response = await fetch(path, { credentials: "include", ...fetchOptions, headers });
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  const looksLikeHtml =
    /text\/html/i.test(contentType) ||
    /^\s*<!DOCTYPE/i.test(rawText) ||
    /^\s*<html[\s>]/i.test(rawText);
  const looksLikeNonJson =
    looksLikeHtml ||
    (response.ok &&
      rawText &&
      !/application\/json/i.test(contentType) &&
      !rawText.trim().startsWith("{") &&
      !rawText.trim().startsWith("["));
  if (looksLikeNonJson) {
    if (import.meta.env.DEV) {
      console.warn("[api] unexpected non-JSON response", {
        url: path,
        status: response.status,
        contentType,
        preview: String(rawText || "").slice(0, 120)
      });
    }
    const error = new Error("We couldn’t load this information. Please try again.");
    error.status = 502;
    error.payload = {
      error: "deployment_misconfigured",
      message: error.message
    };
    throw error;
  }
  let payload = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      if (response.ok) {
        if (import.meta.env.DEV) {
          console.warn("[api] JSON parse failed", {
            url: path,
            status: response.status,
            contentType,
            preview: String(rawText || "").slice(0, 120)
          });
        }
        const error = new Error("We couldn’t load this information. Please try again.");
        error.status = 502;
        error.payload = {
          error: "deployment_misconfigured",
          message: error.message
        };
        throw error;
      }
      payload = {};
    }
  }
  if (payload.csrfToken) storeCsrf(payload.csrfToken);
  if (!response.ok && isCsrfError(response, payload) && !_csrfRetry) {
    const refreshed = await refreshCsrfToken();
    if (refreshed) return api(path, { ...options, _csrfRetry: true });
  }
  if (!response.ok && response.status === 401 && !_sessionRefreshRetry && isPrivateDashboardPath(path)) {
    const refreshedToken = await refreshSupabaseSessionOnce();
    if (refreshedToken) {
      return api(path, {
        ...options,
        _sessionRefreshRetry: true,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${refreshedToken}`
        }
      });
    }
  }
  if (!response.ok) {
    const message = sanitizeClientErrorMessage(payload, payload.error);
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function isPrivateDashboardPath(path) {
  const pathname = String(path || "").split("?")[0];
  return (
    pathname.startsWith("/api/dashboard") ||
    pathname.startsWith("/api/meetings") ||
    pathname.startsWith("/api/integrations") ||
    pathname.startsWith("/api/activities") ||
    pathname.startsWith("/api/students")
  );
}

async function refreshSupabaseSessionOnce() {
  try {
    const supabase = getSupabase();
    if (!supabase?.auth?.refreshSession) return null;
    const { data, error } = await supabase.auth.refreshSession();
    return (!error && data?.session?.access_token) || null;
  } catch {
    return null;
  }
}

function attachFrontendFields(user) {
  if (!user) return null;
  const plan = getPlan(user.plan || "basic");
  return {
    ...user,
    name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    plan: user.plan || "basic",
    planName: plan.name,
    planSelected: Boolean(user.plan),
    emailVerified: Boolean(user.emailVerified),
    role: (user.role || "STUDENT").toLowerCase()
  };
}

export async function getStoredSession() {
  try {
    const { user } = await api("/api/auth/me");
    return attachFrontendFields(user);
  } catch {
    localStorage.removeItem(LEGACY_SESSION_KEY);
    return null;
  }
}

export async function signIn(email, password) {
  const { user } = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  return attachFrontendFields(user);
}

const SIGNUP_ROLES = new Set(["STUDENT", "MENTOR"]);

export async function signUp(payload) {
  const [firstName, ...rest] = (payload.name || "").trim().split(/\s+/);
  const role = (payload.role || "").toUpperCase();
  const inviteToken = String(payload.parentInviteToken || "").trim();
  if (role === "PARENT" && !inviteToken) {
    throw new Error("Parent accounts join through an invitation only.");
  }
  if (role && role !== "PARENT" && !SIGNUP_ROLES.has(role)) {
    throw new Error("Please choose Student or Mentor during onboarding.");
  }
  const body = {
    firstName: payload.firstName || firstName || "Prelude",
    lastName: payload.lastName || rest.join(" ") || "User",
    email: payload.email,
    password: payload.password,
    // Legacy Prisma path still requires a role column; incomplete public signups use STUDENT as a
    // non-finalized placeholder. Production Supabase uses role_selection_complete instead.
    role: role === "PARENT" && inviteToken ? "PARENT" : role === "MENTOR" ? "MENTOR" : "STUDENT",
    termsAccepted: Boolean(payload.termsAccepted ?? true),
    parentInviteToken: inviteToken || undefined
  };
  const result = await api("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
  const user = attachFrontendFields(result.user);
  return {
    ...user,
    message: result.message,
    verificationEmailSent: Boolean(result.verificationEmailSent),
    emailVerified: Boolean(result.user?.emailVerified),
    needsEmailConfirmation: Boolean(result.verificationEmailSent && !result.user?.emailVerified)
  };
}

export async function signOut() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    sessionStorage.removeItem(CSRF_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }
}

export async function requestPasswordReset(email) {
  return api("/api/auth/request-reset", { method: "POST", body: JSON.stringify({ email }) });
}

export async function resetPassword(token, password) {
  return api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
}

export async function verifyEmail(token) {
  return api(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
}

export async function resendVerificationEmail() {
  return api("/api/auth/resend-verification", { method: "POST" });
}

export async function verifyAccountPassword(password) {
  return api("/api/account/verify-password", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export async function deleteAccount({ password, confirmPassword, confirmationPhrase }) {
  try {
    return await api("/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ password, confirmPassword, confirmationPhrase })
    });
  } finally {
    sessionStorage.removeItem(CSRF_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }
}

export async function getDashboardData() {
  return api("/api/dashboard");
}

export async function getProfile() {
  return api("/api/account/profile");
}

export async function updateProfile(profile) {
  return api("/api/account/profile", { method: "PATCH", body: JSON.stringify(profile) });
}

export async function getPreludeMatchQuestionnaire() {
  return api("/api/prelude-match-questionnaire");
}

export async function savePreludeMatchQuestionnaire(payload) {
  return api("/api/prelude-match-questionnaire", { method: "POST", body: JSON.stringify(payload) });
}

export async function getCollegeRecommendations() {
  return api("/api/college-recommendations");
}

export async function getSessions() {
  return api("/api/account/sessions");
}

export async function revokeSession(id) {
  return api(`/api/account/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getBillingConfig() {
  return api("/api/billing/config");
}

async function billingApi(path, options = {}) {
  const sessionResult = await getSupabase()?.auth.getSession();
  const accessToken = sessionResult?.data?.session?.access_token;
  const headers = accessToken
    ? { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` }
    : options.headers;

  return api(path, { ...options, headers });
}

export async function startBillingCheckout(planId, options = {}) {
  return billingApi("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planId, ...options })
  });
}

export async function startBundleCheckout(selection, options = {}) {
  return billingApi("/api/billing/bundle-checkout", {
    method: "POST",
    body: JSON.stringify({ ...selection, ...options })
  });
}

export async function openBillingPortal() {
  return billingApi("/api/billing/portal", { method: "POST" });
}

export function getUserBaseRecord(email) {
  return { email, focus: "college planning", role: "student" };
}
