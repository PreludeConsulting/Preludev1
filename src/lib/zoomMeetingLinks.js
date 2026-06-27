/** Known placeholder Zoom IDs used in local demo fixtures — not real meetings. */
const PLACEHOLDER_ZOOM_PATTERN = /\/j\/(1234567890|9876543210)(?:\?|$)/;

export function normalizeZoomJoinUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.trim();
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

export function isRealZoomJoinUrl(url) {
  return isValidZoomJoinUrl(url);
}

/** Prefer API-backed meetings; never surface demo placeholder Zoom links. */
export function resolveMeetingsForDisplay(apiMeetings, demoMeetings) {
  const api = (apiMeetings ?? []).filter((meeting) => meeting.status !== "pending");
  if (api.length) return api;

  return (demoMeetings ?? []).filter(
    (meeting) => meeting.status !== "pending" && isValidZoomJoinUrl(meeting.zoomJoinUrl)
  );
}

export function findNextJoinableMeeting(meetings) {
  return (meetings ?? []).find((meeting) => isValidZoomJoinUrl(meeting.zoomJoinUrl)) ?? null;
}

/** When calendar merges duplicate day/title entries, keep the one with a real Zoom link. */
export function preferCalendarItemWithZoom(existing, incoming) {
  const existingHasZoom = isValidZoomJoinUrl(existing?.zoomJoinUrl);
  const incomingHasZoom = isValidZoomJoinUrl(incoming?.zoomJoinUrl);
  if (incomingHasZoom && !existingHasZoom) return incoming;
  if (existingHasZoom && !incomingHasZoom) return existing;
  if (incoming?.source === "meeting" && existing?.source === "local") return incoming;
  return existing;
}
