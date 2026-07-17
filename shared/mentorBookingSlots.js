/** Shared mentor booking slots — 1-hour sessions within weekly availability. */

export const MENTOR_SESSION_MINUTES = 60;
export const MENTOR_SLOT_STEP_MINUTES = 60;
export const MENTOR_BOOKING_WINDOW_DAYS = 21;

export const MENTOR_TZ_MAP = Object.freeze({
  ET: "America/New_York",
  CT: "America/Chicago",
  MT: "America/Denver",
  PT: "America/Los_Angeles",
  "Eastern Time": "America/New_York",
  "Central Time": "America/Chicago",
  "Mountain Time": "America/Denver",
  "Pacific Time": "America/Los_Angeles"
});

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const OCCUPYING_STATUSES = new Set(["pending", "scheduled", "approved", "rescheduled"]);

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function resolveMentorTimeZone(timezone) {
  if (!timezone) return "America/New_York";
  const raw = String(timezone).trim();
  if (MENTOR_TZ_MAP[raw]) return MENTOR_TZ_MAP[raw];
  if (raw.includes("/")) return raw;
  const upper = raw.toUpperCase();
  if (MENTOR_TZ_MAP[upper]) return MENTOR_TZ_MAP[upper];
  return "America/New_York";
}

export function minutesFromTime(time24) {
  const [hour, minute] = String(time24 || "00:00")
    .split(":")
    .map(Number);
  return hour * 60 + minute;
}

export function timeFromMinutes(totalMinutes) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function formatSlotLabel(time24) {
  const [hour, minute] = String(time24)
    .split(":")
    .map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${pad2(minute)} ${period}`;
}

export function toIsoDate(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function addDaysToIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Wall-clock parts for an instant in a specific IANA timezone. */
export function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveMentorTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    monthIndex: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
    isoDate: toIsoDate(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  };
}

/**
 * Convert a wall-clock date+time in a timezone to a UTC Date.
 * Uses iterative offset correction (handles DST).
 */
export function zonedDateTimeToUtc(isoDate, time24, timeZone) {
  const iana = resolveMentorTimeZone(timeZone);
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = String(time24)
    .split(":")
    .map(Number);
  // First guess: treat as UTC
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utc), iana);
    const wantedMinutes = hour * 60 + minute;
    const actualMinutes = parts.hour * 60 + parts.minute;
    const dayDrift =
      Date.UTC(parts.year, parts.monthIndex, parts.day) - Date.UTC(year, month - 1, day);
    const deltaMinutes = wantedMinutes - actualMinutes - dayDrift / 60000;
    if (Math.abs(deltaMinutes) < 0.5) break;
    utc += deltaMinutes * 60 * 1000;
  }
  return new Date(utc);
}

export function normalizeAvailabilitySchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    return { timezone: "ET", days: [] };
  }
  return {
    timezone: schedule.timezone || "ET",
    days: Array.isArray(schedule.days) ? schedule.days : []
  };
}

export function getEnabledDayWindow(schedule, weekdayName) {
  const normalized = normalizeAvailabilitySchedule(schedule);
  const day = normalized.days.find(
    (item) =>
      item?.enabled &&
      String(item.dayOfWeek || "").toLowerCase() === String(weekdayName || "").toLowerCase()
  );
  if (!day) return null;
  return {
    startTime: day.startTime,
    endTime: day.endTime,
    timezone: normalized.timezone
  };
}

export function buildOneHourSlotsForWindow({
  startTime,
  endTime,
  durationMinutes = MENTOR_SESSION_MINUTES,
  stepMinutes = MENTOR_SLOT_STEP_MINUTES
} = {}) {
  const startMinutes = minutesFromTime(startTime);
  const endMinutes = minutesFromTime(endTime);
  const lastStart = endMinutes - durationMinutes;
  const slots = [];
  if (lastStart < startMinutes) return slots;
  for (let minutes = startMinutes; minutes <= lastStart; minutes += stepMinutes) {
    slots.push(timeFromMinutes(minutes));
  }
  return slots;
}

export function weekdayNameForIsoDate(isoDate, timeZone) {
  // Noon UTC avoids most DST edge cases when resolving weekday for a calendar date.
  const [year, month, day] = isoDate.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return getZonedParts(probe, timeZone).weekday;
}

export function meetingsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function isOccupyingMeeting(meeting) {
  const status = String(meeting?.status || "").toLowerCase();
  return OCCUPYING_STATUSES.has(status);
}

/**
 * Build bookable 1-hour slots for one calendar date.
 * @returns {Array<{ startTime: string, endTime: string, label: string, startIso: string, endIso: string, available: boolean }>}
 */
export function buildSlotsForDate({
  isoDate,
  schedule,
  meetings = [],
  now = new Date(),
  durationMinutes = MENTOR_SESSION_MINUTES
} = {}) {
  const normalized = normalizeAvailabilitySchedule(schedule);
  const timeZone = normalized.timezone;
  const weekday = weekdayNameForIsoDate(isoDate, timeZone);
  const window = getEnabledDayWindow(normalized, weekday);
  if (!window) return [];

  const starts = buildOneHourSlotsForWindow({
    startTime: window.startTime,
    endTime: window.endTime,
    durationMinutes
  });

  const occupying = meetings.filter(isOccupyingMeeting);

  return starts.map((startTime) => {
    const endTime = timeFromMinutes(minutesFromTime(startTime) + durationMinutes);
    const startUtc = zonedDateTimeToUtc(isoDate, startTime, timeZone);
    const endUtc = zonedDateTimeToUtc(isoDate, endTime, timeZone);
    const taken = occupying.some((meeting) => {
      const meetingStart = new Date(meeting.startTime || meeting.start);
      const meetingEnd = new Date(meeting.endTime || meeting.end);
      if (Number.isNaN(meetingStart.getTime()) || Number.isNaN(meetingEnd.getTime())) return false;
      return meetingsOverlap(startUtc, endUtc, meetingStart, meetingEnd);
    });
    const inPast = endUtc.getTime() <= now.getTime();
    return {
      date: isoDate,
      startTime,
      endTime,
      label: `${formatSlotLabel(startTime)} – ${formatSlotLabel(endTime)}`,
      startIso: startUtc.toISOString(),
      endIso: endUtc.toISOString(),
      available: !taken && !inPast,
      taken,
      inPast
    };
  });
}

export function listBookableDates({
  schedule,
  meetings = [],
  now = new Date(),
  windowDays = MENTOR_BOOKING_WINDOW_DAYS
} = {}) {
  const normalized = normalizeAvailabilitySchedule(schedule);
  const timeZone = normalized.timezone;
  const todayParts = getZonedParts(now, timeZone);
  const dates = [];

  for (let offset = 0; offset < windowDays; offset += 1) {
    const isoDate = addDaysToIsoDate(todayParts.isoDate, offset);
    const slots = buildSlotsForDate({ isoDate, schedule: normalized, meetings, now });
    const available = slots.filter((slot) => slot.available);
    if (!available.length && !slots.length) continue;
    dates.push({
      date: isoDate,
      weekday: weekdayNameForIsoDate(isoDate, timeZone),
      label: formatDateOptionLabel(isoDate, timeZone),
      slots,
      availableSlots: available,
      hasAvailability: available.length > 0
    });
  }

  return dates.filter((day) => day.slots.length > 0);
}

export function formatDateOptionLabel(isoDate, timeZone) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const probe = zonedDateTimeToUtc(isoDate, "12:00", timeZone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: resolveMentorTimeZone(timeZone),
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(probe);
}

/**
 * Validate a proposed 1-hour booking against schedule + existing meetings.
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
export function validateMentorBookingSlot({
  startTime,
  endTime,
  schedule,
  meetings = [],
  now = new Date(),
  durationMinutes = MENTOR_SESSION_MINUTES
} = {}) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, code: "invalid_time", message: "Meeting time is invalid." };
  }
  const durationMs = end.getTime() - start.getTime();
  if (Math.abs(durationMs - durationMinutes * 60 * 1000) > 60 * 1000) {
    return {
      ok: false,
      code: "invalid_duration",
      message: "Mentor sessions must be exactly one hour long."
    };
  }
  if (start.getTime() <= now.getTime() - 5 * 60 * 1000) {
    return { ok: false, code: "in_past", message: "Meeting must be scheduled in the future." };
  }

  const normalized = normalizeAvailabilitySchedule(schedule);
  const timeZone = normalized.timezone;
  const parts = getZonedParts(start, timeZone);
  const isoDate = parts.isoDate;
  const startHm = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  const slots = buildSlotsForDate({
    isoDate,
    schedule: normalized,
    meetings,
    now,
    durationMinutes
  });
  const match = slots.find(
    (slot) => slot.startTime === startHm && slot.available && slot.startIso === start.toISOString()
  );
  // Allow slight ISO string mismatch by comparing epoch.
  const matchByEpoch = slots.find(
    (slot) =>
      slot.available &&
      Math.abs(new Date(slot.startIso).getTime() - start.getTime()) < 60 * 1000 &&
      Math.abs(new Date(slot.endIso).getTime() - end.getTime()) < 60 * 1000
  );

  if (!match && !matchByEpoch) {
    const anySlot = slots.find(
      (slot) =>
        Math.abs(new Date(slot.startIso).getTime() - start.getTime()) < 60 * 1000
    );
    if (anySlot?.taken) {
      return {
        ok: false,
        code: "slot_taken",
        message: "That time slot is already booked. Please choose another available time."
      };
    }
    return {
      ok: false,
      code: "outside_availability",
      message: "That time is outside your mentor’s availability. Choose an open slot."
    };
  }

  return { ok: true };
}

export function summarizeOpenSlots(schedule, meetings = [], now = new Date()) {
  const days = listBookableDates({ schedule, meetings, now });
  return days.map((day) => ({
    date: day.date,
    weekday: day.weekday,
    label: day.label,
    openCount: day.availableSlots.length,
    takenCount: day.slots.filter((slot) => slot.taken).length,
    slots: day.slots.map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: slot.label,
      available: slot.available,
      taken: slot.taken
    }))
  }));
}

export { DAY_NAMES };
