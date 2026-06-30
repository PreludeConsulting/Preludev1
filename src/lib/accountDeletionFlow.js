/**
 * Account deletion re-authentication (OAuth redirect resume) and local cache cleanup.
 */

const PENDING_DELETION_KEY = "prelude_pending_account_deletion";
const PENDING_DELETION_MAX_AGE_MS = 10 * 60 * 1000;

export function storePendingOAuthAccountDeletion({ userId, email, returnPath, provider = "google" }) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.setItem(
      PENDING_DELETION_KEY,
      JSON.stringify({
        mode: "oauth",
        userId,
        email,
        returnPath: returnPath || window.location.pathname,
        provider,
        initiatedAt: Date.now()
      })
    );
  } catch {
    /* storage unavailable */
  }
}

export function readPendingOAuthAccountDeletion() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_DELETION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || parsed.mode !== "oauth") return null;
    if (Date.now() - Number(parsed.initiatedAt || 0) > PENDING_DELETION_MAX_AGE_MS) {
      clearPendingOAuthAccountDeletion();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingOAuthAccountDeletion() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_DELETION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearLocalUserData(userId, email = "") {
  if (typeof window === "undefined") return;

  const normalizedEmail = (email || "").trim().toLowerCase();

  try {
    if (userId) {
      window.localStorage.removeItem(`prelude_plan_${userId}`);
      window.localStorage.removeItem(`prelude_onboarding_draft_${userId}`);
      window.localStorage.removeItem(`prelude_parent_invite_done_${userId}`);
      window.localStorage.removeItem(`prelude_parent_invites_${userId}`);
      window.localStorage.removeItem(`prelude_parent_guardian_email_${userId}`);
      window.localStorage.removeItem(`prelude_dash_store_${userId}`);
      window.sessionStorage.removeItem(`prelude_parent_reminder_dismissed_${userId}`);
    }
    if (normalizedEmail) {
      window.localStorage.removeItem(`prelude-progress-rewards-${normalizedEmail}`);
      window.localStorage.removeItem(`prelude-reward-shop-${normalizedEmail}`);
      window.localStorage.removeItem(`prelude-gamification-${normalizedEmail}`);
    }
    window.sessionStorage.removeItem("prelude_pending_parent_invite");
    window.sessionStorage.removeItem("prelude_pending_parent_email_connect");
    clearPendingOAuthAccountDeletion();
  } catch {
    /* ignore */
  }
}

export function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}
