function resolveCategory(event) {
  return event.category || event.raw?.category || "";
}

export function isMentorUpcomingMeeting(event) {
  const category = resolveCategory(event);
  if (category === "mentor_availability") return false;
  if (category === "pending_request") return false;
  if (category === "mentor_private") return false;
  if (category === "application_deadline" || category === "essay_deadline" || category === "scholarship_deadline") {
    return false;
  }
  if (category === "personal_task") return false;

  return (
    event.source === "meeting"
    || category === "mentor_meeting"
    || event.type === "mentor"
  );
}

export function filterMentorUpcomingEvents(events) {
  return events.filter(isMentorUpcomingMeeting);
}
