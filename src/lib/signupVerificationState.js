const STORAGE_KEY = "prelude-pending-signup-verification";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function storePendingSignupVerification(email, { cooldownSeconds = 30 } = {}) {
  if (typeof window === "undefined") return null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const state = {
    email: normalizedEmail,
    createdAt: Date.now(),
    resendAllowedAt: Date.now() + Math.max(0, Number(cooldownSeconds) || 0) * 1000
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function readPendingSignupVerification() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    const email = normalizeEmail(state?.email);
    const createdAt = Number(state?.createdAt);
    if (!email || !Number.isFinite(createdAt) || Date.now() - createdAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      email,
      createdAt,
      resendAllowedAt: Number(state?.resendAllowedAt) || 0
    };
  } catch {
    return null;
  }
}

export function clearPendingSignupVerification() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export function pendingSignupResendSeconds(state = readPendingSignupVerification()) {
  if (!state?.resendAllowedAt) return 0;
  return Math.max(0, Math.ceil((state.resendAllowedAt - Date.now()) / 1000));
}
