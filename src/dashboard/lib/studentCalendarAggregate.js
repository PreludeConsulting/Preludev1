/**
 * Load and merge calendar surfaces for a student (fixtures + local persistence).
 * Used to keep mentor / parent / student views aligned.
 */

import { getStudentDemoBundleBySlug } from "./studentDemoBundle.js";
import { loadLocalDashboardStore } from "./localDashboardStore.js";
import { resolveStudentUserId } from "./sharedCalendarEvents.js";

function tagStudentMeta(items, student) {
  if (!student?.id) return items || [];
  return (items || []).map((item) => ({
    ...item,
    studentId: item.studentId || student.id,
    studentName: item.studentName || student.name
  }));
}

export function loadStudentCalendarSurface(student) {
  if (!student?.id) {
    return { fixtureEvents: [], userEvents: [], meetings: [], deadlines: [] };
  }

  const bundle = getStudentDemoBundleBySlug(student.id);
  const userId = resolveStudentUserId(student.id) || student.id;
  const local = loadLocalDashboardStore(userId);

  return {
    fixtureEvents: tagStudentMeta(bundle?.events || [], student),
    userEvents: tagStudentMeta(local.calendarEvents || [], student),
    meetings: tagStudentMeta(bundle?.meetings || [], student),
    deadlines: tagStudentMeta(bundle?.deadlines || [], student)
  };
}

export function aggregateStudentCalendars(students = []) {
  const fixtureEvents = [];
  const userEvents = [];
  const meetings = [];
  const deadlines = [];
  const seenEventKeys = new Set();

  for (const student of students) {
    const surface = loadStudentCalendarSurface(student);
    for (const event of [...surface.fixtureEvents, ...surface.userEvents]) {
      const key = `${event.id || event.title}-${event.start}`;
      if (seenEventKeys.has(key)) continue;
      seenEventKeys.add(key);
      if (event.userCreated) {
        userEvents.push(event);
      } else {
        fixtureEvents.push(event);
      }
    }
    meetings.push(...surface.meetings);
    deadlines.push(...surface.deadlines);
  }

  return { fixtureEvents, userEvents, meetings, deadlines };
}
