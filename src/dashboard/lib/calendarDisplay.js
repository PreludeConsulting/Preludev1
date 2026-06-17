import { compactEventTitle } from "../components/CalendarEventPill.jsx";

export function studentFirstName(name = "") {
  return name.trim().split(/\s+/)[0] || "";
}

export function formatCalendarPillTitle(event, { mentorView = false } = {}) {
  const raw = event.raw || {};
  const title = event.title || "";
  const studentName = event.studentName || raw.studentName;
  const firstName = studentFirstName(studentName);
  const compact = compactEventTitle(title);

  if (mentorView && firstName) {
    const prefix = `${firstName} · `;
    if (title.toLowerCase().startsWith(`${firstName.toLowerCase()} ·`)) {
      return compactEventTitle(title);
    }
    return `${firstName} · ${compact}`;
  }

  return compact;
}
