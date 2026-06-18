import { getPlan } from "./plans.js";

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
  const { _csrfRetry, ...fetchOptions } = options;
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const csrf = getCsrfToken();
  if (csrf && !["GET", "HEAD", "OPTIONS"].includes(options.method || "GET")) headers["X-CSRF-Token"] = csrf;
  const response = await fetch(path, { credentials: "include", ...fetchOptions, headers });
  const payload = await response.json().catch(() => ({}));
  if (payload.csrfToken) storeCsrf(payload.csrfToken);
  if (!response.ok && isCsrfError(response, payload) && !_csrfRetry) {
    const refreshed = await refreshCsrfToken();
    if (refreshed) return api(path, { ...options, _csrfRetry: true });
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

export async function signUp(payload) {
  const [firstName, ...rest] = (payload.name || "").trim().split(/\s+/);
  const body = {
    firstName: payload.firstName || firstName || "Student",
    lastName: payload.lastName || rest.join(" ") || "User",
    email: payload.email,
    password: payload.password,
    role: (payload.role || "student").toUpperCase(),
    termsAccepted: Boolean(payload.termsAccepted ?? true)
  };
  const result = await api("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
  return {
    ...attachFrontendFields(result.user),
    message: result.message,
    verificationEmailSent: Boolean(result.verificationEmailSent),
    emailVerified: Boolean(result.user?.emailVerified)
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

export async function getSessions() {
  return api("/api/account/sessions");
}

export async function revokeSession(id) {
  return api(`/api/account/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getBillingConfig() {
  return api("/api/billing/config");
}

export async function startBillingCheckout(planId) {
  return api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planId }) });
}

export async function openBillingPortal() {
  return api("/api/billing/portal", { method: "POST" });
}

export function getUserBaseRecord(email) {
  return { email, focus: "college planning", role: "student" };
}
