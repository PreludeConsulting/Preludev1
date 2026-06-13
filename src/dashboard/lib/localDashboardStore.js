/**
 * Per-user browser persistence for dashboard data when Supabase/Prisma is unavailable.
 */

const PREFIX = "prelude_dash_store_";

export function defaultLocalDashboardStore() {
  return {
    calendarEvents: [],
    tasks: [],
    essays: [],
    savedColleges: null,
    conversationMessages: [],
    profileOverrides: {}
  };
}

export function loadLocalDashboardStore(userId) {
  if (!userId || typeof window === "undefined") return defaultLocalDashboardStore();
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${userId}`);
    if (!raw) return defaultLocalDashboardStore();
    return { ...defaultLocalDashboardStore(), ...JSON.parse(raw) };
  } catch {
    return defaultLocalDashboardStore();
  }
}

export function saveLocalDashboardStore(userId, store) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }
}

export function patchLocalDashboardStore(userId, patch) {
  const current = loadLocalDashboardStore(userId);
  const next = { ...current, ...patch };
  saveLocalDashboardStore(userId, next);
  return next;
}
