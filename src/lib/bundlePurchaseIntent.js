import { resolveBundleId } from "../../shared/supportBundles.js";

const PENDING_BUNDLE_KEY = "prelude_pending_bundle_intent";

function intentStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function savePendingBundleIntent(bundleId) {
  if (typeof window === "undefined" || !bundleId) return;
  const resolved = resolveBundleId(bundleId);
  try {
    intentStorage()?.setItem(
      PENDING_BUNDLE_KEY,
      JSON.stringify({ bundleId: resolved, mode: "bundles", ts: Date.now() })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekPendingBundleIntent() {
  if (typeof window === "undefined") return null;
  try {
    // Read the old session-scoped key as a one-time compatibility fallback.
    const raw =
      intentStorage()?.getItem(PENDING_BUNDLE_KEY) ||
      window.sessionStorage.getItem(PENDING_BUNDLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.bundleId) return null;
    return { ...parsed, bundleId: resolveBundleId(parsed.bundleId) };
  } catch {
    return null;
  }
}

export function clearPendingBundleIntent() {
  if (typeof window === "undefined") return;
  try {
    intentStorage()?.removeItem(PENDING_BUNDLE_KEY);
    window.sessionStorage.removeItem(PENDING_BUNDLE_KEY);
  } catch {
    /* ignore */
  }
}

export function consumePendingBundleIntent() {
  const intent = peekPendingBundleIntent();
  if (intent) clearPendingBundleIntent();
  return intent;
}

export function buildBundleWalletPath({ payment = false, bundleId, mentorId, mentorUserId } = {}) {
  const base = payment ? "/onboarding/payment" : "/plans";
  const params = new URLSearchParams({
    mode: "bundles",
    wallet: "open"
  });
  const resolved = bundleId ? resolveBundleId(bundleId) : null;
  if (resolved) params.set("bundle", resolved);
  if (resolved) params.set("details", "open");
  if (mentorId) params.set("mentor", String(mentorId));
  if (mentorUserId) params.set("mentorUserId", String(mentorUserId));
  return `${base}?${params.toString()}`;
}

export function pendingBundlePaymentPath() {
  const pending = peekPendingBundleIntent();
  return pending?.bundleId
    ? buildBundleWalletPath({ payment: true, bundleId: pending.bundleId })
    : "/onboarding/payment";
}

export function bundleCheckoutFailureAction(error, returnUrl) {
  if (error?.status === 401) {
    return {
      type: "login",
      path: "/login",
      state: { from: returnUrl },
      message: "Your session expired. Sign in again to continue to checkout."
    };
  }
  if (error?.status === 403) {
    return {
      type: "authorization_error",
      message: error.message || "Your account cannot start this checkout yet. Please refresh and try again."
    };
  }
  return null;
}
