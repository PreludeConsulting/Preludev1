import { resolveBundleId } from "../../shared/supportBundles.js";

const PENDING_BUNDLE_KEY = "prelude_pending_bundle_intent";

export function savePendingBundleIntent(bundleId) {
  if (typeof window === "undefined" || !bundleId) return;
  const resolved = resolveBundleId(bundleId);
  try {
    window.sessionStorage.setItem(
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
    const raw = window.sessionStorage.getItem(PENDING_BUNDLE_KEY);
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

export function buildBundleWalletPath({ payment = false, bundleId } = {}) {
  const base = payment ? "/onboarding/payment" : "/plans";
  const params = new URLSearchParams({
    mode: "bundles",
    wallet: "open"
  });
  const resolved = bundleId ? resolveBundleId(bundleId) : null;
  if (resolved) params.set("bundle", resolved);
  if (resolved) params.set("details", "open");
  return `${base}?${params.toString()}`;
}
