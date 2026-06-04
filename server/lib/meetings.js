import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "../data/meetings.json");

/** @typedef {'zoom' | 'in_person' | 'phone'} MeetingType */
/** @typedef {'scheduled' | 'pending' | 'approved' | 'declined' | 'canceled' | 'rescheduled'} MeetingStatus */

/**
 * @typedef {object} MeetingRecord
 * @property {string} id
 * @property {string} title
 * @property {string} studentId
 * @property {string} mentorId
 * @property {MeetingType} meetingType
 * @property {string} startTime ISO
 * @property {string} endTime ISO
 * @property {string} timeZone
 * @property {string|null} zoomMeetingId
 * @property {string|null} zoomJoinUrl
 * @property {string|null} zoomHostUrl
 * @property {MeetingStatus} status
 * @property {string} notes
 * @property {boolean} isPrivate
 * @property {string|null} studentUserId
 * @property {string|null} mentorUserId
 */

function ensureStore() {
  const dir = dirname(DATA_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify({ meetings: seedMeetings() }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function writeStore(data) {
  ensureStore();
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function seedMeetings() {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  start.setHours(16, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 45);
  return [
    {
      id: "meet-demo-1",
      title: "Essay strategy check-in",
      studentId: "student-demo-1",
      mentorId: "mentor-demo-1",
      studentUserId: null,
      mentorUserId: null,
      meetingType: "zoom",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      timeZone: "America/New_York",
      zoomMeetingId: "placeholder-8842011",
      zoomJoinUrl: "https://zoom.us/j/placeholder-student-join",
      zoomHostUrl: "https://zoom.us/s/placeholder-host-start",
      status: "scheduled",
      notes: "",
      isPrivate: false
    }
  ];
}

/** Placeholder Zoom links — swap for Zoom API in production. */
export function createPlaceholderZoomLinks(meetingId) {
  const suffix = meetingId.replace(/[^a-z0-9]/gi, "").slice(-8) || randomBytes(4).toString("hex");
  return {
    zoomMeetingId: `placeholder-${suffix}`,
    zoomJoinUrl: `https://zoom.us/j/placeholder-${suffix}`,
    zoomHostUrl: `https://zoom.us/s/placeholder-host-${suffix}`
  };
}

export function shouldAttachZoom(meetingType, isPrivate, explicitZoom = false) {
  if (isPrivate && !explicitZoom) return false;
  return meetingType === "zoom";
}

export function listMeetingsForUser({ userId, role }) {
  const { meetings } = readStore();
  const r = role?.toUpperCase();
  return meetings.filter((m) => {
    if (m.status === "canceled") return false;
    if (r === "MENTOR") return m.mentorUserId === userId || (!m.mentorUserId && m.mentorId);
    if (r === "STUDENT") return (m.studentUserId === userId || (!m.studentUserId && m.studentId)) && !m.isPrivate;
    return false;
  });
}

export function getMeetingById(id) {
  return readStore().meetings.find((m) => m.id === id) || null;
}

export function createMeeting(payload) {
  const data = readStore();
  const id = `meet-${randomBytes(6).toString("hex")}`;
  const record = {
    id,
    title: payload.title || "Mentor meeting",
    studentId: payload.studentId,
    mentorId: payload.mentorId,
    studentUserId: payload.studentUserId ?? null,
    mentorUserId: payload.mentorUserId ?? null,
    meetingType: payload.meetingType || "zoom",
    startTime: payload.startTime,
    endTime: payload.endTime,
    timeZone: payload.timeZone || "America/New_York",
    zoomMeetingId: null,
    zoomJoinUrl: null,
    zoomHostUrl: null,
    status: payload.status || "scheduled",
    notes: payload.notes || "",
    isPrivate: Boolean(payload.isPrivate)
  };

  if (shouldAttachZoom(record.meetingType, record.isPrivate, payload.explicitZoom)) {
    const zoom = createPlaceholderZoomLinks(id);
    Object.assign(record, zoom);
  }

  data.meetings.push(record);
  writeStore(data);
  return record;
}

export function updateMeeting(id, patch) {
  const data = readStore();
  const idx = data.meetings.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const current = data.meetings[idx];
  const next = { ...current, ...patch };
  if (patch.meetingType && shouldAttachZoom(next.meetingType, next.isPrivate) && !next.zoomJoinUrl) {
    Object.assign(next, createPlaceholderZoomLinks(id));
  }
  if (next.meetingType !== "zoom") {
    next.zoomMeetingId = null;
    next.zoomJoinUrl = null;
    next.zoomHostUrl = null;
  }
  data.meetings[idx] = next;
  writeStore(data);
  return next;
}

export function sanitizeMeetingForRole(meeting, role) {
  if (!meeting) return null;
  const copy = { ...meeting };
  if (role?.toUpperCase() !== "MENTOR") {
    delete copy.zoomHostUrl;
  }
  return copy;
}
