/** Known placeholder Zoom IDs used in local demo fixtures — not real meetings. */
const PLACEHOLDER_ZOOM_PATTERN = /\/j\/(1234567890|9876543210)(?:\?|$)/;

export const VIDEO_MEETING_TYPES = ["zoom", "google_meet"];

export function normalizeZoomJoinUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.trim();
}

export function isVideoMeetingType(meetingType) {
  return meetingType === "zoom" || meetingType === "google_meet";
}

export function meetingTypeLabel(meetingType) {
  if (meetingType === "google_meet") return "Google Meet";
  if (meetingType === "zoom") return "Zoom";
  return "Meeting";
}

export function isPlaceholderZoomJoinUrl(url) {
  if (!url || typeof url !== "string") return false;
  return PLACEHOLDER_ZOOM_PATTERN.test(url) || url.includes("placeholder-student-join");
}

/** Valid mentor-provided https://zoom.us/j/… or https://subdomain.zoom.us/j/… links. */
export function isValidZoomJoinUrl(url) {
  const trimmed = normalizeZoomJoinUrl(url);
  if (!trimmed || isPlaceholderZoomJoinUrl(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "zoom.us" || host.endsWith(".zoom.us");
  } catch {
    return false;
  }
}

/** Valid mentor-provided https://meet.google.com/… links. */
export function isValidGoogleMeetJoinUrl(url) {
  const trimmed = normalizeZoomJoinUrl(url);
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname.toLowerCase() === "meet.google.com";
  } catch {
    return false;
  }
}

export function inferMeetingTypeFromUrl(url) {
  if (isValidGoogleMeetJoinUrl(url)) return "google_meet";
  if (isValidZoomJoinUrl(url)) return "zoom";
  return null;
}

export function isValidMeetingJoinUrl(url, meetingType) {
  if (meetingType === "google_meet") return isValidGoogleMeetJoinUrl(url);
  if (meetingType === "zoom") return isValidZoomJoinUrl(url);
  return isValidZoomJoinUrl(url) || isValidGoogleMeetJoinUrl(url);
}

export function isJoinableMeeting(meeting) {
  if (!meeting?.zoomJoinUrl) return false;
  const meetingType = meeting.meetingType || inferMeetingTypeFromUrl(meeting.zoomJoinUrl) || "zoom";
  return isValidMeetingJoinUrl(meeting.zoomJoinUrl, meetingType);
}

export function isRealZoomJoinUrl(url) {
  return isValidZoomJoinUrl(url);
}

/** Prefer API-backed meetings; never surface demo placeholder Zoom links. */
export function resolveMeetingsForDisplay(apiMeetings, demoMeetings) {
  const api = (apiMeetings ?? []).filter((meeting) => meeting.status !== "pending");
  if (api.length) return api;

  return (demoMeetings ?? []).filter(
    (meeting) => meeting.status !== "pending" && isJoinableMeeting(meeting)
  );
}

export function findNextJoinableMeeting(meetings) {
  return (meetings ?? []).find((meeting) => isJoinableMeeting(meeting)) ?? null;
}

/** When calendar merges duplicate day/title entries, keep the one with a real join link. */
export function preferCalendarItemWithZoom(existing, incoming) {
  const existingHasJoin = isJoinableMeeting(existing) || isValidMeetingJoinUrl(existing?.zoomJoinUrl);
  const incomingHasJoin = isJoinableMeeting(incoming) || isValidMeetingJoinUrl(incoming?.zoomJoinUrl);
  if (incomingHasJoin && !existingHasJoin) return incoming;
  if (existingHasJoin && !incomingHasJoin) return existing;
  if (incoming?.source === "meeting" && existing?.source === "local") return incoming;
  return existing;
}
