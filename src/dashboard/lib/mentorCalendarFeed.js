const DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

export function parseRequestedTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = String(value).match(
    /[A-Za-z]{3},\s*([A-Za-z]{3})\s+(\d{1,2})\s*[·•]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (!match) return null;

  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const month = months[match[1].toLowerCase().slice(0, 3)];
  if (month == null) return null;

  const year = new Date().getFullYear();
  const day = Number.parseInt(match[2], 10);
  let hour = Number.parseInt(match[3], 10);
  const minute = Number.parseInt(match[4], 10);
  const ampm = match[5].toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return new Date(year, month, day, hour, minute, 0, 0);
}

function parseAvailabilityHours(timeRange = "") {
  const match = String(timeRange).match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return { startHour: 16, startMinute: 0, endHour: 18, endMinute: 0 };

  let startHour = Number.parseInt(match[1], 10);
  const startMinute = Number.parseInt(match[2], 10);
  let endHour = Number.parseInt(match[3], 10);
  const endMinute = Number.parseInt(match[4], 10);
  const ampm = match[5].toUpperCase();

  if (ampm === "PM") {
    if (startHour < 12) startHour += 12;
    if (endHour < 12) endHour += 12;
  }

  return { startHour, startMinute, endHour, endMinute };
}

function nextWeekdayOccurrences(dayName, count = 6) {
  const target = DAY_INDEX[String(dayName || "").toLowerCase()];
  if (target == null) return [];

  const dates = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; dates.length < count && i < 90; i += 1) {
    const diff = (target - cursor.getDay() + 7) % 7;
    const next = new Date(cursor);
    next.setDate(cursor.getDate() + (diff === 0 && dates.length ? 7 : diff));
    dates.push(next);
    cursor.setDate(next.getDate() + 1);
  }

  return dates;
}

export function buildMentorCalendarExtras({
  pendingRequests = [],
  availability = [],
  students = []
} = {}) {
  const events = [];
  const seenPending = new Set();

  pendingRequests.forEach((request) => {
    const start = parseRequestedTime(request.requestedTime || request.startTime || request.start);
    if (!start) return;

    const end = new Date(start.getTime() + 45 * 60 * 1000);
    const id = `pending-req-${request.id}`;
    if (seenPending.has(id)) return;
    seenPending.add(id);

    events.push({
      id,
      title: `Request: ${request.studentName || "Student"}`,
      category: "pending_request",
      description: request.type,
      start: start.toISOString(),
      end: end.toISOString(),
      pillColor: "orange",
      shared: false
    });
  });

  availability
    .filter((slot) => slot.active)
    .forEach((slot) => {
      const { startHour, startMinute, endHour, endMinute } = parseAvailabilityHours(slot.time);
      nextWeekdayOccurrences(slot.day, 6).forEach((date, index) => {
        const start = new Date(date);
        start.setHours(startHour, startMinute, 0, 0);
        const end = new Date(date);
        end.setHours(endHour, endMinute, 0, 0);

        events.push({
          id: `avail-${slot.id}-${index}`,
          title: `Available for help · ${slot.day}`,
          category: "mentor_availability",
          description: `${slot.time} · Open for texting and extra help`,
          start: start.toISOString(),
          end: end.toISOString(),
          pillColor: "green",
          mentorOnly: true,
          shared: false
        });
      });
    });

  students.forEach((student, index) => {
    const deadlineCount = student.upcomingDeadlines ?? 0;
    if (!deadlineCount) return;

    const start = new Date();
    start.setDate(start.getDate() + 4 + index * 3);
    start.setHours(23, 59, 0, 0);

    events.push({
      id: `student-deadline-${student.id}`,
      title: `${student.name} deadline`,
      category: "application_deadline",
      description: `${deadlineCount} upcoming deadline${deadlineCount === 1 ? "" : "s"}`,
      start: start.toISOString(),
      end: start.toISOString(),
      pillColor: "red",
      shared: true
    });
  });

  return events;
}
