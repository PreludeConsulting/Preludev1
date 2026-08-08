import {
  listBookableDates,
  normalizeAvailabilitySchedule,
  formatSlotLabel
} from "../../shared/mentorBookingSlots.js";

const TZ_ABBREVIATIONS = {
  ET: "ET",
  CT: "CT",
  MT: "MT",
  PT: "PT",
  "Eastern Time": "ET",
  "Central Time": "CT",
  "Mountain Time": "MT",
  "Pacific Time": "PT",
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT"
};

function timezoneLabel(timezone) {
  const raw = String(timezone || "ET").trim();
  return TZ_ABBREVIATIONS[raw] || (raw.length <= 3 ? raw.toUpperCase() : "ET");
}

/**
 * Nearest upcoming opening from a mentor's LIVE availability_schedule.
 * Reuses the canonical shared slot engine (timezone-aware, DST-safe, week
 * rollover) — it does NOT introduce a competing availability model.
 *
 * @returns {string|null} e.g. "Tuesday, 4:00 PM ET", or null when none.
 */
export function computeNextOpening(schedule, now = new Date()) {
  const normalized = normalizeAvailabilitySchedule(schedule);
  if (!normalized.days.some((day) => day?.enabled)) return null;

  const dates = listBookableDates({ schedule: normalized, now });
  for (const day of dates) {
    const slot = (day.availableSlots || [])[0];
    if (slot) {
      return `${day.weekday}, ${formatSlotLabel(slot.startTime)} ${timezoneLabel(normalized.timezone)}`;
    }
  }
  return null;
}
