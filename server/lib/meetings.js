/**
 * Backwards-compatible meeting module facade.
 * Prefer meetingStore.js and meetingSchedule.js for new code.
 */
export {
  createMeetingRecord as createMeeting,
  getMeetingById,
  listMeetingsForUser,
  sanitizeMeetingForRole,
  shouldAttachZoom,
  updateMeetingRecord as updateMeeting
} from "./meetingStore.js";
