export const CONTACT_EMAIL = "preludesupport@preludeconsultingllc.com";
export const CONTACT_PHONE_LABEL = "Discovery call";
export const CONTACT_TIME_ZONE = "Eastern Time - US & Canada";
export const CONTACT_TIME_ZONE_ID = "America/New_York";
export const DISCOVERY_CALL_MINUTES = 30;
export const CALL_SLOT_STEP_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 11;

export const CALL_WINDOWS = {
  weekday: {
    label: "Monday-Friday",
    days: [1, 2, 3, 4, 5],
    start: "10:00",
    end: "16:00"
  },
  saturday: {
    label: "Saturday",
    days: [6],
    start: "12:00",
    end: "15:00"
  }
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

const EASTERN_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CONTACT_TIME_ZONE_ID,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function utcDateFromIso(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function minutesFromTime(time24) {
  const [hour, minute] = time24.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

function getMonthKey({ year, monthIndex }) {
  return `${year}-${pad(monthIndex + 1)}`;
}

function addDaysToIsoDate(isoDate, days) {
  const date = utcDateFromIso(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function toIsoDate(year, monthIndex, day) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

export function getEasternDateTime(now = new Date()) {
  const parts = Object.fromEntries(
    EASTERN_PARTS_FORMATTER.formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: parts.year,
    monthIndex: parts.month - 1,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    isoDate: toIsoDate(parts.year, parts.month - 1, parts.day)
  };
}

export function getBookingWindow(now = new Date(), windowDays = BOOKING_WINDOW_DAYS) {
  const today = getEasternDateTime(now).isoDate;

  return {
    startIsoDate: today,
    endIsoDate: addDaysToIsoDate(today, windowDays - 1),
    windowDays
  };
}

export function buildScheduleMonths(now = new Date(), windowDays = BOOKING_WINDOW_DAYS) {
  const bookingWindow = getBookingWindow(now, windowDays);
  const start = utcDateFromIso(bookingWindow.startIsoDate);
  const end = utcDateFromIso(bookingWindow.endIsoDate);
  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor <= end) {
    months.push({ year: cursor.getUTCFullYear(), monthIndex: cursor.getUTCMonth() });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export function buildCallWindowSlots({
  start,
  end,
  durationMinutes = DISCOVERY_CALL_MINUTES,
  stepMinutes = CALL_SLOT_STEP_MINUTES
}) {
  const startMinutes = minutesFromTime(start);
  const lastStartMinutes = minutesFromTime(end) - durationMinutes;
  const slots = [];

  for (let minutes = startMinutes; minutes <= lastStartMinutes; minutes += stepMinutes) {
    slots.push(timeFromMinutes(minutes));
  }

  return slots;
}

export function buildAvailableCallSlots({
  now = new Date(),
  windows = CALL_WINDOWS,
  windowDays = BOOKING_WINDOW_DAYS,
  months = buildScheduleMonths(now, windowDays)
} = {}) {
  const currentEastern = getEasternDateTime(now);
  const currentMinutes = currentEastern.hour * 60 + currentEastern.minute;
  const bookingWindow = getBookingWindow(now, windowDays);

  return months.reduce((slotsByDate, { year, monthIndex }) => {
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, monthIndex, day));
      const isoDate = toIsoDate(year, monthIndex, day);

      if (isoDate < bookingWindow.startIsoDate || isoDate > bookingWindow.endIsoDate) {
        continue;
      }

      const dayOfWeek = date.getUTCDay();
      const window = Object.values(windows).find((candidate) => candidate.days.includes(dayOfWeek));

      if (window) {
        const slots = buildCallWindowSlots(window).filter((slot) => {
          if (isoDate !== currentEastern.isoDate) return true;
          return minutesFromTime(slot) > currentMinutes;
        });

        if (slots.length) {
          slotsByDate[isoDate] = slots;
        }
      }
    }

    return slotsByDate;
  }, {});
}

export function getFirstAvailableDate(availableSlots) {
  return Object.keys(availableSlots).sort()[0] || "";
}

export function buildContactSchedule(now = new Date(), windowDays = BOOKING_WINDOW_DAYS) {
  const months = buildScheduleMonths(now, windowDays);
  const availableCallSlots = buildAvailableCallSlots({ now, months, windowDays });
  const firstAvailableDate = getFirstAvailableDate(availableCallSlots);

  return {
    months,
    availableCallSlots,
    bookingWindow: getBookingWindow(now, windowDays),
    firstAvailableDate,
    firstAvailableTime: availableCallSlots[firstAvailableDate]?.[0] || ""
  };
}

const DEFAULT_SCHEDULE = buildContactSchedule();

export const SCHEDULE_MONTHS = DEFAULT_SCHEDULE.months;
export const AVAILABLE_CALL_SLOTS = DEFAULT_SCHEDULE.availableCallSlots;
export const DEFAULT_SELECTED_DATE = DEFAULT_SCHEDULE.firstAvailableDate;
export const DEFAULT_SELECTED_TIME = DEFAULT_SCHEDULE.firstAvailableTime;

export function formatMonthLabel(year, monthIndex) {
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, monthIndex, 1)));
}

export function formatDateLabel(isoDate) {
  if (!isoDate) return "";
  return LONG_DATE_FORMATTER.format(utcDateFromIso(isoDate));
}

export function formatTimeLabel(time24) {
  if (!time24) return "";
  const [hourRaw, minute] = time24.split(":").map(Number);
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  const hour = hourRaw % 12 || 12;
  return `${hour}:${pad(minute)} ${suffix}`;
}

export function getCalendarCells(year, monthIndex, availableSlots = AVAILABLE_CALL_SLOTS) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ key: `blank-${index}`, day: null, isoDate: null, available: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoDate = toIsoDate(year, monthIndex, day);
    cells.push({
      key: isoDate,
      day,
      isoDate,
      available: Boolean(availableSlots[isoDate]?.length)
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, day: null, isoDate: null, available: false });
  }

  return cells;
}

export function getAvailableTimes(isoDate, availableSlots = AVAILABLE_CALL_SLOTS) {
  return availableSlots[isoDate] || [];
}

export function buildContactEmailSubject({ selectedDate, selectedTime } = {}) {
  if (selectedDate && selectedTime) {
    return `Prelude discovery call request - ${formatDateLabel(selectedDate)} at ${formatTimeLabel(selectedTime)}`;
  }
  return "Prelude admissions support question";
}

export function buildContactEmailBody({
  selectedDate = "",
  selectedTime = "",
  name = "",
  email = "",
  phone = "",
  studentYear = "",
  topic = ""
} = {}) {
  const lines = [
    "Hi Prelude team,",
    "",
    selectedDate && selectedTime
      ? `I would like to request the ${DISCOVERY_CALL_MINUTES}-minute discovery call on ${formatDateLabel(selectedDate)} at ${formatTimeLabel(selectedTime)} (${CONTACT_TIME_ZONE}).`
      : "I would like to learn more about Prelude.",
    "",
    "My details:",
    `Name: ${name.trim() || "[Your name]"}`,
    `Email: ${email.trim() || "[Your email]"}`,
    `Phone: ${phone.trim() || "[Your phone, optional]"}`,
    `Student year: ${studentYear.trim() || "[Student year]"}`,
    "",
    "What I want help with:",
    topic.trim() || "[Tell us about college list, essays, mentoring, SAT/ACT prep, tutoring, pricing, or parent support.]",
    "",
    "Thank you!"
  ];

  return lines.join("\n");
}

export function buildMailtoHref(options = {}) {
  const subject = buildContactEmailSubject(options);
  const body = buildContactEmailBody(options);
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildGmailComposeUrl(options = {}) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: CONTACT_EMAIL,
    su: buildContactEmailSubject(options),
    body: buildContactEmailBody(options)
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}
