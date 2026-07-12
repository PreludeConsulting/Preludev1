const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

const WEEKLY_DAY_DEFAULTS = [
  { dayOfWeek: "Monday", defaultStart: "09:00", defaultEnd: "17:00" },
  { dayOfWeek: "Tuesday", defaultStart: "14:00", defaultEnd: "18:00" },
  { dayOfWeek: "Wednesday", defaultStart: "16:00", defaultEnd: "20:00" },
  { dayOfWeek: "Thursday", defaultStart: "13:00", defaultEnd: "17:00" },
  { dayOfWeek: "Friday", defaultStart: "09:00", defaultEnd: "13:00" },
  { dayOfWeek: "Saturday", defaultStart: "09:00", defaultEnd: "17:00" },
  { dayOfWeek: "Sunday", defaultStart: "09:00", defaultEnd: "17:00" }
];

const CALENDLY_DAYS = [
  { key: "Sunday", label: "Sun" },
  { key: "Monday", label: "Mon" },
  { key: "Tuesday", label: "Tue" },
  { key: "Wednesday", label: "Wed" },
  { key: "Thursday", label: "Thu" },
  { key: "Friday", label: "Fri" },
  { key: "Saturday", label: "Sat" }
];

const TIMEZONES = [
  { value: "ET", label: "Eastern Time (ET)" },
  { value: "CT", label: "Central Time (CT)" },
  { value: "MT", label: "Mountain Time (MT)" },
  { value: "PT", label: "Pacific Time (PT)" }
];

const DEFAULT_WEEKLY_FORM = {
  timezone: "ET",
  days: WEEKLY_DAY_DEFAULTS.map(({ dayOfWeek, defaultStart, defaultEnd }) => ({
    dayOfWeek,
    enabled: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(dayOfWeek),
    startTime: defaultStart,
    endTime: defaultEnd
  }))
};

function pad2(value) {
  return String(value).padStart(2, "0");
}

function format12Hour(hour24, minute) {
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${pad2(minute)} ${period}`;
}

function format12HourCalendly(hour24, minute) {
  const period = hour24 >= 12 ? "pm" : "am";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${pad2(minute)} ${period}`;
}

export function buildTimeOptions(stepMinutes = 30, style = "default") {
  const options = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const value = `${pad2(hour24)}:${pad2(minute)}`;
    options.push({
      value,
      label: style === "calendly" ? format12HourCalendly(hour24, minute) : format12Hour(hour24, minute)
    });
  }
  return options;
}

export function formatAvailabilityRange(startTime, endTime, timezone = "ET") {
  if (!startTime || !endTime) return "";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return `${format12Hour(sh, sm)} – ${format12Hour(eh, em)} ${timezone}`;
}

export function slotDurationHours(slot) {
  if (!slot?.active) return 0;
  if (slot.startTime && slot.endTime) {
    const [sh, sm] = slot.startTime.split(":").map(Number);
    const [eh, em] = slot.endTime.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return Math.max(0, (end - start) / 60);
  }

  const match = String(slot.time || "").match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (!match) return 0;

  const to24 = (hour, minute, period) => {
    let h = Number(hour);
    const m = Number(minute);
    if (period.toUpperCase() === "PM" && h !== 12) h += 12;
    if (period.toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const start = to24(match[1], match[2], match[3]);
  const end = to24(match[4], match[5], match[6]);
  return Math.max(0, (end - start) / 60);
}

export function normalizeAvailabilitySlot(slot, index = 0) {
  const day = slot.day || "Monday";
  const timezone = slot.timezone || "ET";
  const startTime = slot.startTime || "14:00";
  const endTime = slot.endTime || "16:00";
  const active = slot.active !== false;
  const recurring = slot.recurring !== false;

  return {
    id: slot.id || `av-${index}`,
    day,
    startTime,
    endTime,
    timezone,
    time: slot.time || formatAvailabilityRange(startTime, endTime, timezone),
    recurring,
    active
  };
}

export function createEmptyAvailabilitySlot() {
  return normalizeAvailabilitySlot({
    id: `av-${Date.now()}`,
    day: "Friday",
    startTime: "14:00",
    endTime: "16:00",
    timezone: "ET",
    recurring: true,
    active: true
  });
}

export function countWeeklyHours(slots) {
  return slots
    .filter((slot) => slot.active)
    .reduce((sum, slot) => sum + slotDurationHours(slot), 0);
}

export function slotsToWeeklyFormState(slots = []) {
  const timezone = slots.find((slot) => slot.timezone)?.timezone || DEFAULT_WEEKLY_FORM.timezone;

  return {
    timezone,
    days: WEEKLY_DAY_DEFAULTS.map(({ dayOfWeek, defaultStart, defaultEnd }) => {
      const slot = slots.find((item) => item.day === dayOfWeek && item.active !== false);
      return {
        dayOfWeek,
        enabled: Boolean(slot),
        startTime: slot?.startTime || defaultStart,
        endTime: slot?.endTime || defaultEnd
      };
    })
  };
}

export function weeklyFormStateToSlots(state, existingSlots = []) {
  const timezone = state.timezone || DEFAULT_WEEKLY_FORM.timezone;

  return (state.days || [])
    .filter((day) => day.enabled)
    .map((day, index) => {
      const existing = existingSlots.find((slot) => slot.day === day.dayOfWeek);
      return normalizeAvailabilitySlot(
        {
          id: existing?.id || `av-${day.dayOfWeek.toLowerCase()}`,
          day: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          timezone,
          recurring: true,
          active: true
        },
        index
      );
    });
}

export function formatWeeklyAvailabilitySummary(state) {
  const timezone = state?.timezone || "ET";
  const enabledDays = (state?.days || []).filter((day) => day.enabled);
  if (!enabledDays.length) return "";

  return enabledDays
    .map((day) => {
      const range = formatAvailabilityRange(day.startTime, day.endTime, timezone);
      const shortDay = day.dayOfWeek.slice(0, 3);
      return `${shortDay} ${range.replace(` ${timezone}`, "")}`.trim();
    })
    .join(" · ")
    .concat(` ${timezone}`);
}

export function scheduleToWeeklyFormState(schedule) {
  if (schedule && typeof schedule === "object" && Array.isArray(schedule.days) && schedule.days.length) {
    return {
      timezone: schedule.timezone || DEFAULT_WEEKLY_FORM.timezone,
      days: WEEKLY_DAY_DEFAULTS.map(({ dayOfWeek, defaultStart, defaultEnd }) => {
        const day = schedule.days.find((item) => item.dayOfWeek === dayOfWeek);
        return {
          dayOfWeek,
          enabled: Boolean(day?.enabled),
          startTime: day?.startTime || defaultStart,
          endTime: day?.endTime || defaultEnd
        };
      })
    };
  }
  return {
    timezone: DEFAULT_WEEKLY_FORM.timezone,
    days: DEFAULT_WEEKLY_FORM.days.map((day) => ({ ...day }))
  };
}

export function validateWeeklyFormState(state) {
  const enabledDays = (state.days || []).filter((day) => day.enabled);

  if (!enabledDays.length) {
    return "Select at least one available day.";
  }

  for (const day of enabledDays) {
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    if (endMinutes <= startMinutes) {
      return `${day.dayOfWeek}: end time must be after start time.`;
    }
  }

  return "";
}

/** @deprecated Use slotsToWeeklyFormState */
export function slotsToCalendlyState(slots = []) {
  return slotsToWeeklyFormState(slots);
}

/** @deprecated Use weeklyFormStateToSlots */
export function calendlyStateToSlots(state, existingSlots = []) {
  return weeklyFormStateToSlots(state, existingSlots);
}

export {
  DAYS,
  WEEKLY_DAY_DEFAULTS,
  CALENDLY_DAYS,
  TIMEZONES,
  DEFAULT_WEEKLY_FORM
};
