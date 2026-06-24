/**
 * In-browser calendar reminder scheduling.
 *
 * TODO: Replace timeout-based reminders with a service worker + push notifications
 * so alerts fire when the app is closed or in the background.
 */

import { loadPreferences } from "./dashboardPreferences.js";
import { appPath } from "../../lib/appPaths.js";
import { STUDENT_DASHBOARD_BASE } from "../../lib/dashboardRoutes.js";

export const REMINDER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "5", label: "5 minutes before" },
  { value: "10", label: "10 minutes before" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" }
];

/** @deprecated Use getDefaultReminderMinutes() for user-aware defaults. */
export const DEFAULT_REMINDER_MINUTES = "15";

export function getDefaultReminderMinutes() {
  const prefs = loadPreferences();
  const value = String(prefs.reminderLeadTime || DEFAULT_REMINDER_MINUTES);
  const allowed = REMINDER_OPTIONS.map((opt) => opt.value);
  return allowed.includes(value) ? value : DEFAULT_REMINDER_MINUTES;
}

const STORAGE_KEY = "prelude-calendar-reminders";
const scheduledTimeouts = new Map();

export function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function isReminderEnabled(reminderMinutes) {
  return reminderMinutes && reminderMinutes !== "none";
}

export function reminderLabel(reminderMinutes) {
  const match = REMINDER_OPTIONS.find((opt) => opt.value === String(reminderMinutes));
  return match?.label ?? "None";
}

function readStoredReminders() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStoredReminders(records) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore quota errors in demo mode
  }
}

function upsertStoredReminder(record) {
  const next = readStoredReminders().filter((item) => item.id !== record.id);
  next.push(record);
  writeStoredReminders(next);
}

function removeStoredReminder(id) {
  writeStoredReminders(readStoredReminders().filter((item) => item.id !== id));
}

function openDashboardHome() {
  window.focus();
  window.location.href = appPath(`${STUDENT_DASHBOARD_BASE}/overview`);
}

function buildNotificationCopy({ title, reminderMinutes, isTask }) {
  const minutes = Number(reminderMinutes);
  const timePhrase = isTask ? `Due in ${minutes} minutes` : `Starts in ${minutes} minutes`;
  return {
    title: isTask ? `Upcoming task: ${title}` : `Upcoming event: ${title}`,
    body: timePhrase
  };
}

export function cancelCalendarReminder(id) {
  const timeoutId = scheduledTimeouts.get(id);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledTimeouts.delete(id);
  }
  removeStoredReminder(id);
}

export function scheduleCalendarReminder({
  id,
  title,
  start,
  reminderMinutes,
  formVariant,
  onTrigger
}) {
  cancelCalendarReminder(id);

  if (!isReminderEnabled(reminderMinutes)) return null;

  const minutes = Number(reminderMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  const startTime = new Date(start).getTime();
  const notifyAt = startTime - minutes * 60 * 1000;
  const delay = notifyAt - Date.now();
  const isTask = formVariant === "task";

  const record = {
    id,
    title,
    start,
    reminderMinutes: String(reminderMinutes),
    formVariant: formVariant || "event"
  };
  upsertStoredReminder(record);

  if (delay <= 0) return { skipped: "past" };

  const timeoutId = window.setTimeout(() => {
    scheduledTimeouts.delete(id);
    removeStoredReminder(id);

    if (getNotificationPermission() === "granted" && "Notification" in window) {
      const copy = buildNotificationCopy({ title, reminderMinutes: minutes, isTask });
      const notification = new Notification(copy.title, {
        body: copy.body,
        tag: `prelude-reminder-${id}`
      });
      notification.onclick = () => {
        notification.close();
        openDashboardHome();
      };
    }

    onTrigger?.({
      id,
      title,
      body: buildNotificationCopy({ title, reminderMinutes: minutes, isTask }).body,
      isTask
    });
  }, delay);

  scheduledTimeouts.set(id, timeoutId);
  return { scheduledFor: new Date(notifyAt).toISOString() };
}

export function rescheduleStoredReminders(onTrigger) {
  readStoredReminders().forEach((record) => {
    scheduleCalendarReminder({ ...record, onTrigger });
  });
}
