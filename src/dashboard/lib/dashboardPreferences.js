/**
 * Local, browser-persisted dashboard preferences.
 *
 * These are genuine client-side preferences (stored in localStorage) — they do
 * NOT pretend to talk to a backend. Display preferences (density / reduced
 * motion) are applied to the document so they take real effect on the
 * dashboard, and everything is namespaced under `.dash-*` so other pages are
 * unaffected. Communication-style preferences (email/notification toggles) are
 * stored so they can be wired to a real backend later without breaking the UI.
 */

const STORAGE_KEY = "prelude_dashboard_prefs";

export const DEFAULT_PREFERENCES = {
  // Email & notifications
  emailUpdates: true,
  meetingReminders: true,
  mentorMessages: true,
  studentMessages: true,
  deadlineReminders: true,
  progressReminders: true,
  rewardUpdates: true,
  essayComments: true,
  collegeApplicationUpdates: true,
  scholarshipReminders: true,
  parentSummaries: false,
  notificationSounds: true,
  interfaceSounds: true,
  weeklyDigest: false,
  digestFrequency: "weekly",
  quietHoursEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "07:00",
  productTips: false,
  // Calendar & meetings
  defaultCalendarView: "month",
  reminderLeadTime: "30",
  weekStart: "sunday",
  // Display & accessibility (applied to the dashboard)
  theme: "system",
  density: "comfortable",
  reduceMotion: false,
  hapticFeedback: true,
  profileVisibility: "mentors_only",
  dataExportRequestedAt: null
};

export function loadPreferences() {
  if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs) {
  const next = { ...DEFAULT_PREFERENCES, ...prefs };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — preferences simply won't persist */
  }
  applyPreferences(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("prelude-preferences-changed", { detail: next }));
  }
  return next;
}

/** Reflects display preferences onto the document root (dashboard-scoped CSS). */
export function applyPreferences(prefs = loadPreferences()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.dashDensity = prefs.density === "compact" ? "compact" : "comfortable";
  root.dataset.dashMotion = prefs.reduceMotion ? "reduced" : "full";
  root.dataset.dashTheme = prefs.theme === "dark" || prefs.theme === "light" ? prefs.theme : "system";
  root.style.colorScheme = prefs.theme === "dark" ? "dark" : "light";
}
