/**
 * Account deletion re-authentication (OAuth redirect resume).
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

export function clearLocalUserData(userId) {
  if (typeof window === "undefined" || !userId) return;
  const prefixes = [
    "prelude_plan_",
    "prelude_parent_invites_",
    "prelude_parent_guardian_email_",
    "prelude_parent_invite_done_",
    "prelude_chat_messages_",
    "prelude_chat_threads_",
    "prelude_dashboard_prefs"
  ];

  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key === `prelude_plan_${userId}`) window.localStorage.removeItem(key);
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        /* keep shared prefs; only remove user-scoped keys above */
      }
    }
    window.localStorage.removeItem(`prelude_plan_${userId}`);
  } catch {
    /* ignore */
  }
}
