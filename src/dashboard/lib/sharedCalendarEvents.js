import { DEMO_SLUGS } from "../../data/demoDashboardData.js";
import { loadLocalDashboardStore, saveLocalDashboardStore } from "./localDashboardStore.js";

const SLUG_TO_DEMO_USER_ID = {
  [DEMO_SLUGS.jordan]: "demo-student",
  [DEMO_SLUGS.alex]: "demo-student2"
};

export function resolveStudentUserId(studentId) {
  if (!studentId) return null;
  return SLUG_TO_DEMO_USER_ID[studentId] || studentId;
}

export function syncSharedEventToStudent(studentId, event) {
  const userId = resolveStudentUserId(studentId);
  if (!userId || !event) return;

  const store = loadLocalDashboardStore(userId);
  const sharedEvent = {
    ...event,
    shared: true,
    mentorCreated: true,
    studentId,
    studentName: event.studentName
  };
  const existing = store.calendarEvents || [];
  const next = existing.some((item) => item.id === sharedEvent.id)
    ? existing.map((item) => (item.id === sharedEvent.id ? sharedEvent : item))
    : [...existing, sharedEvent];
  saveLocalDashboardStore(userId, { ...store, calendarEvents: next });
}

export function removeSharedEventFromStudent(studentId, eventId) {
  const userId = resolveStudentUserId(studentId);
  if (!userId || !eventId) return;

  const store = loadLocalDashboardStore(userId);
  const next = (store.calendarEvents || []).filter((item) => item.id !== eventId);
  saveLocalDashboardStore(userId, { ...store, calendarEvents: next });
}
