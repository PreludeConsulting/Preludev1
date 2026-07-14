import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { isValidMeetingJoinUrl, preferCalendarItemWithZoom } from "../../../lib/zoomMeetingLinks.js";
import { cn } from "../../../lib/utils.js";
import { compactEventTitle } from "../CalendarEventPill.jsx";
import { formatCalendarPillTitle } from "../../lib/calendarDisplay.js";
import { isMentorUpcomingMeeting } from "../../lib/mentorCalendarFilters.js";
import { CalendarAddEventModal, CalendarEventDetailModal } from "../CalendarEventModals.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { useInteractionFeedback } from "../../../components/interaction/InteractionFeedback.jsx";
import { useInterfaceSound } from "../../../lib/sound/SoundProvider.jsx";
import AnimatedIcon from "../../../components/interaction/AnimatedIcon.jsx";
import { loadPreferences } from "../../lib/dashboardPreferences.js";
import { EVENT_CATEGORY_LABELS } from "../../data/placeholders.js";
import { EmptyState, Modal, SecondaryButton } from "../ui/index.jsx";
import { usePlanAccess } from "../../hooks/usePlanAccess.js";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekdayLabels(weekStart = "sunday") {
  if (weekStart === "monday") {
    return [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];
  }
  return WEEKDAY_LABELS;
}

function getWeekStartDate(date, weekStart = "sunday") {
  const start = new Date(date);
  const day = start.getDay();
  const offset = weekStart === "monday" ? (day + 6) % 7 : day;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

const EXCLUDED_EVENT_PATTERN = /office\s*hours|update\s+(extracurricular\s+)?activities(\s+list)?/i;

const CREATE_OPTIONS = [
  { id: "event", label: "Event", category: "mentor_meeting", modalTitle: "Create event", formVariant: "event" },
  { id: "task", label: "Task", category: "personal_task", modalTitle: "Create task", formVariant: "task" }
];
const TASK_ONLY_CREATE_OPTIONS = CREATE_OPTIONS.filter((option) => option.id === "task");

const CALENDAR_EVENT_CATEGORIES = new Set([
  "mentor_meeting",
  "essay_deadline",
  "application_deadline",
  "scholarship_deadline"
]);

/** red → yellow → green → blue → orange → repeat */
const PILL_COLOR_CYCLE = ["red", "yellow", "green", "blue", "orange"];

const SAMPLE_TONE_BY_TITLE = [
  ["robotics club", "red"],
  ["college list strategy", "blue"],
  ["mentor meeting", "blue"],
  ["sat test", "green"],
  ["sat ", "green"],
  ["ap calculus", "yellow"],
  ["ap exam", "yellow"],
  ["georgia tech", "orange"],
  ["fafsa", "green"],
  ["common app", "blue"],
  ["uc application", "orange"],
  ["personal statement", "yellow"],
  ["supplement", "orange"],
  ["mites", "blue"],
  ["course registration", "yellow"]
];

const TYPE_TO_CATEGORY = {
  mentor: "mentor_meeting",
  essay: "essay_deadline",
  application: "application_deadline",
  financial: "scholarship_deadline",
  research: "personal_task"
};

function buildMonthGrid(year, month, weekStart = "sunday") {
  const first = new Date(year, month, 1);
  let startPad = first.getDay();
  if (weekStart === "monday") {
    startPad = (startPad + 6) % 7;
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapCategoryToType(category = "") {
  const key = String(category).toLowerCase();
  if (key.includes("mentor") || key === "mentor_meeting" || key === "mentor_availability") return "mentor";
  if (key.includes("essay")) return "essay";
  if (key.includes("scholarship") || key.includes("financial") || key.includes("fafsa") || key.includes("aid")) return "financial";
  if (key.includes("research")) return "research";
  if (key.includes("application")) return "application";
  if (key === "personal_task") return "research";
  return "application";
}

function resolveCategory(event) {
  if (event.category) return event.category;
  return TYPE_TO_CATEGORY[event.type] || "application_deadline";
}

function resolveSamplePillTone(title = "") {
  const key = title.toLowerCase();
  const match = SAMPLE_TONE_BY_TITLE.find(([pattern]) => key.includes(pattern));
  if (match) return match[1];

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i)) % PILL_COLOR_CYCLE.length;
  }
  return PILL_COLOR_CYCLE[hash];
}

function resolveMentorStudentViewPillTone(event) {
  const category = String(resolveCategory(event)).toLowerCase();
  const raw = event.raw || {};
  const kind = resolveCalendarItemKind(event);
  const isMentorCreated = Boolean(raw.mentorCreated || raw.createdByRole === "mentor");

  if (
    category.includes("deadline")
    || category === "pending_request"
    || category === "scholarship_deadline"
  ) {
    return "orange";
  }

  if (
    isMentorCreated
    || category === "mentor_meeting"
    || event.source === "meeting"
    || event.type === "mentor"
    || kind === "task"
  ) {
    return "green";
  }

  if (category === "personal_task") {
    return isMentorCreated ? "green" : "orange";
  }

  return "green";
}

function resolvePillTone(event, { mentorStudentView = false } = {}) {
  if (mentorStudentView) return resolveMentorStudentViewPillTone(event);
  return event.colorTone || resolveSamplePillTone(event.title);
}

function resolveCalendarItemKind(item) {
  if (!item) return "event";

  const raw = item.raw || {};
  const formVariant = item.formVariant ?? raw.formVariant;
  const calendarItemType = item.calendarItemType ?? raw.calendarItemType;

  if (formVariant === "task" || calendarItemType === "task") return "task";
  if (formVariant === "event" || calendarItemType === "event") return "event";

  const category = String(raw.category ?? item.category ?? "").toLowerCase();
  if (CALENDAR_EVENT_CATEGORIES.has(category)) return "event";

  if (item.source === "meeting" || item.source === "deadline") return "event";
  if (item.type === "mentor") return "event";

  const meetingType = raw.meetingType ?? item.meeting?.meetingType;
  if (meetingType === "zoom" || meetingType === "google_meet") return "event";
  if (item.zoomJoinUrl || raw.zoomJoinUrl) return "event";
  if (item.meeting || raw.meeting) return "event";

  const compactTitle = compactEventTitle(item.title || "");
  const titleBlob = `${item.title || ""} ${compactTitle}`.toLowerCase();
  if (/\b(zoom call|mentor meeting|strategy session|essay planning)\b/.test(titleBlob)) return "event";

  return "event";
}

function withItemKind(item) {
  return { ...item, itemKind: resolveCalendarItemKind(item) };
}

function findLocalEventRaw(modalEvent, localEvents) {
  if (!modalEvent) return null;
  return localEvents.find((item) => `ev-${item.id}` === modalEvent.id || item.id === modalEvent.id) || null;
}

function isExcludedCalendarEvent(item) {
  const title = (item.title || "").trim();
  if (!title) return false;
  return EXCLUDED_EVENT_PATTERN.test(title);
}

function normalizeDeadline(deadline) {
  const date = parseDate(deadline.dueDate);
  if (!date || deadline.done) return null;

  const type = mapCategoryToType(deadline.category);
  return withItemKind({
    id: `dl-${deadline.id}`,
    title: deadline.title,
    date,
    endDate: null,
    type,
    allDay: true,
    description: `${deadline.category || "Deadline"}${deadline.priority ? ` · ${deadline.priority} priority` : ""}`,
    colorTone: resolveSamplePillTone(deadline.title),
    source: "deadline",
    raw: deadline
  });
}

function normalizeMeeting(meeting, { mentorView = false } = {}) {
  if (!mentorView && meeting.status === "pending") return null;

  const date = parseDate(meeting.startTime);
  if (!date) return null;

  const isPending = meeting.status === "pending";

  return withItemKind({
    id: `mt-${meeting.id}`,
    title: isPending ? `Pending: ${meeting.title}` : meeting.title,
    date,
    endDate: parseDate(meeting.endTime),
    type: "mentor",
    allDay: false,
    description: meeting.notes,
    zoomJoinUrl: meeting.zoomJoinUrl,
    meetingType: meeting.meetingType || "zoom",
    meeting,
    studentId: meeting.studentId,
    studentName: meeting.studentName,
    colorTone: isPending ? "orange" : resolveSamplePillTone(meeting.title),
    category: isPending ? "pending_request" : "mentor_meeting",
    source: "meeting",
    raw: meeting
  });
}

function normalizeCalendarEvent(event, { mentorView = false } = {}) {
  const isMentorScoped =
    event.mentorOnly
    || event.category === "mentor_private"
    || event.category === "mentor_availability"
    || event.category === "pending_request";

  if (isMentorScoped && !mentorView) return null;

  const date = parseDate(event.start || event.startTime);
  if (!date) return null;

  const endDate = parseDate(event.end || event.endTime);
  const isUserCreated = Boolean(event.userCreated) || Boolean(event.pillColor) || event.eventType === "personal" || event.eventType === "session" || String(event.id).startsWith("evt-");
  const category = event.category || TYPE_TO_CATEGORY[event.type] || "application_deadline";
  const meetingType = event.meetingType || (category === "mentor_meeting" ? "zoom" : undefined);

  return withItemKind({
    id: `ev-${event.id}`,
    title: event.title,
    date,
    endDate,
    type: mapCategoryToType(category),
    allDay: !endDate || date.toDateString() === endDate.toDateString(),
    description: event.description || event.notes,
    zoomJoinUrl: event.zoomJoinUrl,
    meetingType,
    meeting: event.meeting,
    studentId: event.studentId,
    studentName: event.studentName,
    colorTone:
      event.pillColor
      || (category === "pending_request" ? "orange" : null)
      || (category === "mentor_availability" ? "green" : null)
      || (category === "mentor_private" ? "purple" : null)
      || resolveSamplePillTone(event.title),
    formVariant: event.formVariant,
    calendarItemType: event.calendarItemType,
    category,
    source: isUserCreated ? "local" : "event",
    raw: event
  });
}

function isCalendarTask(item) {
  return resolveCalendarItemKind(item) === "task";
}

function isCalendarEvent(item) {
  return resolveCalendarItemKind(item) === "event";
}

function dayCellTone(dayEvents) {
  if (!dayEvents.length) return null;

  const hasTask = dayEvents.some(isCalendarTask);
  const hasEvent = dayEvents.some(isCalendarEvent);

  if (hasTask && hasEvent) return "mixed";
  if (hasTask) return "tasks";
  if (hasEvent) return "events";
  return null;
}

function mergeEvents({ deadlines = [], meetings = [], events = [], mentorView = false }) {
  const merged = [
    ...(mentorView ? [] : deadlines.map(normalizeDeadline).filter(Boolean)),
    ...meetings.map((meeting) => normalizeMeeting(meeting, { mentorView })).filter(Boolean),
    ...events.map((event) => normalizeCalendarEvent(event, { mentorView })).filter(Boolean)
  ];

  const byKey = new Map();
  merged.forEach((item) => {
    const key = `${item.date.toDateString()}::${item.title}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      return;
    }
    byKey.set(key, preferCalendarItemWithZoom(existing, item));
  });

  return [...byKey.values()].filter((item) => !isExcludedCalendarEvent(item));
}

function eventsForDay(allEvents, year, month, day) {
  return allEvents
    .filter((event) => {
      const d = event.date;
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    })
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.date.getTime() - b.date.getTime();
    });
}

function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function eventsForCalendarDate(allEvents, date) {
  return allEvents
    .filter((event) => isSameCalendarDay(event.date, date))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.date.getTime() - b.date.getTime();
    });
}

function formatEventTime(event) {
  if (event.allDay) return "All day";
  return event.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function toDetailModalEvent(event, mentorName, students = [], { mentorStudentView = false } = {}) {
  const end = event.endDate || event.date;
  const category = resolveCategory(event);
  const studentName = event.studentName
    || event.raw?.studentName
    || students.find((student) => student.id === event.studentId)?.name;
  const manageable = event.source === "local";

  return {
    id: event.id,
    title: event.title,
    start: event.date.toISOString(),
    end: end.toISOString(),
    category,
    extendedProps: {
      category,
      description: event.description,
      zoomJoinUrl: event.zoomJoinUrl,
      meeting: event.meeting,
      meetingType: event.meetingType || event.raw?.meetingType || event.meeting?.meetingType || (category === "mentor_meeting" ? "zoom" : undefined),
      mentorName,
      studentId: event.studentId || event.raw?.studentId,
      studentName,
      manageable
    }
  };
}

function useMaxVisibleEvents() {
  const [max, setMax] = useState(2);

  useEffect(() => {
    const tablet = window.matchMedia("(max-width: 1099px)");
    const mobile = window.matchMedia("(max-width: 639px)");

    const update = () => {
      if (mobile.matches) setMax(0);
      else if (tablet.matches) setMax(1);
      else setMax(2);
    };

    update();
    tablet.addEventListener("change", update);
    mobile.addEventListener("change", update);
    return () => {
      tablet.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, []);

  return max;
}

function UpcomingEventRow({ event, onSelect, mentorView = false, mentorStudentView = false }) {
  const tone = resolvePillTone(event, { mentorStudentView });
  const label = formatCalendarPillTitle(event, { mentorView });

  return (
    <li>
      <button type="button" className="dash-upcoming-events__row" onClick={() => onSelect(event)}>
        <span
          className={cn("dash-upcoming-events__marker", `dash-upcoming-events__marker--${tone}`)}
          aria-hidden="true"
        />
        <span className="dash-upcoming-events__content">
          <span className="dash-upcoming-events__event-title">{label}</span>
          <span className="dash-upcoming-events__event-meta">{formatEventTime(event)}</span>
        </span>
      </button>
    </li>
  );
}

function UpcomingEventsColumn({ label, events, onEventSelect, mentorView = false, mentorStudentView = false }) {
  return (
    <section className="dash-upcoming-events__column">
      <h4 className="dash-upcoming-events__column-label">{label}</h4>
      {events.length ? (
        <ul className="dash-upcoming-events__list">
          {events.map((event) => (
            <UpcomingEventRow
              key={event.id}
              event={event}
              onSelect={onEventSelect}
              mentorView={mentorView}
              mentorStudentView={mentorStudentView}
            />
          ))}
        </ul>
      ) : (
        <p className="dash-upcoming-events__column-empty">No events scheduled</p>
      )}
    </section>
  );
}

function UpcomingEventsPanel({
  allEvents,
  onEventSelect,
  title = "Upcoming Events",
  mentorView = false,
  mentorStudentView = false,
  eventFilter = null
}) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sourceEvents = eventFilter ? allEvents.filter(eventFilter) : allEvents;
  const todayEvents = eventsForCalendarDate(sourceEvents, now);
  const tomorrowEvents = eventsForCalendarDate(sourceEvents, tomorrow);
  const hasEvents = todayEvents.length > 0 || tomorrowEvents.length > 0;

  return (
    <article className="dash-product-card dash-upcoming-events">
      <header className="dash-upcoming-events__head">
        <h3 className="dash-upcoming-events__title">{title}</h3>
        {hasEvents ? (
          <p className="dash-upcoming-events__summary">
            {todayEvents.length} Today · {tomorrowEvents.length} Tomorrow
          </p>
        ) : null}
      </header>
      {hasEvents ? (
        <div className="dash-upcoming-events__columns">
          <UpcomingEventsColumn label="Today" events={todayEvents} onEventSelect={onEventSelect} mentorView={mentorView} mentorStudentView={mentorStudentView} />
          <UpcomingEventsColumn label="Tomorrow" events={tomorrowEvents} onEventSelect={onEventSelect} mentorView={mentorView} mentorStudentView={mentorStudentView} />
        </div>
      ) : (
        <p className="dash-upcoming-events__empty">No upcoming events.</p>
      )}
    </article>
  );
}

function EventPill({ event, onSelect, mentorView = false, mentorStudentView = false, flashId = null, exitId = null }) {
  const category = resolveCategory(event);
  const tone = resolvePillTone(event, { mentorStudentView });
  const label = EVENT_CATEGORY_LABELS[category] || category;
  const displayTitle = formatCalendarPillTitle(event, { mentorView });
  const flash = flashId && event.id === flashId;
  const exiting = exitId && event.id === exitId;

  return (
    <button
      type="button"
      className={cn(
        "dash-cal-visual__pill dash-cal-event",
        `dash-cal-visual__pill--${tone}`,
        flash && "dash-cal-event--flash",
        exiting && "dash-cal-event--exit"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
      aria-label={`${displayTitle}, ${label}, ${formatEventTime(event)}`}
    >
      <span className="dash-cal-visual__pill-label">{displayTitle}</span>
      <span className="dash-cal-visual__pill-tip" role="tooltip">
        <strong>{event.title}</strong>
        <span>{label} · {formatEventTime(event)}</span>
        {event.description ? <em>{event.description}</em> : null}
      </span>
    </button>
  );
}

function useClickOutside(ref, handler, active) {
  useEffect(() => {
    if (!active) return undefined;

    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) handler();
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [ref, handler, active]);
}

function CalendarCreateMenu({ onSelect, plusActive = false, options = CREATE_OPTIONS }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useClickOutside(rootRef, () => setOpen(false), open);

  return (
    <div className="dash-cal-visual__create" ref={rootRef}>
      <button
        type="button"
        className="dash-cal-visual__create-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        <AnimatedIcon variant="plus" active={plusActive}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </AnimatedIcon>
        <span>Create</span>
        <ChevronDown className={cn("dash-cal-visual__create-chevron", open && "dash-cal-visual__create-chevron--open")} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="dash-cal-visual__create-menu" role="menu">
          {options.map((option) => (
            <li key={option.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="dash-cal-visual__create-item"
                onClick={() => {
                  setOpen(false);
                  onSelect(option);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DayAgendaPanel({ date, events, onClose, onEventSelect, mentorView = false, mentorStudentView = false }) {
  if (!date) return null;

  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={label}
      footer={<SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton>}
    >
      {events.length ? (
        <ul className="dash-cal-visual__agenda-list">
          {events.map((event) => {
            const category = resolveCategory(event);
            const tone = resolvePillTone(event, { mentorStudentView });
            return (
              <li key={event.id}>
                <button type="button" className="dash-cal-visual__agenda-item" onClick={() => onEventSelect(event)}>
                  <span className={cn("dash-cal-visual__pill", `dash-cal-visual__pill--${tone}`, "dash-cal-visual__agenda-pill")}>
                    {formatCalendarPillTitle(event, { mentorView })}
                  </span>
                  <span className="dash-cal-visual__agenda-meta">
                    {EVENT_CATEGORY_LABELS[category]} · {formatEventTime(event)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="dash-cal-visual__agenda-empty">No events scheduled for this day.</p>
      )}
    </Modal>
  );
}

export default function AdmissionsCalendarVisual({
  deadlines = [],
  meetings = [],
  events = [],
  students = [],
  mentorName = "Maya Patel",
  role = "student",
  mentorView = false,
  showStudentFilter = false,
  studentFilter = "",
  onStudentFilterChange,
  showUpcomingEvents = false,
  upcomingEventsPlacement = "inline",
  upcomingEventsMountEl = null,
  upcomingTitle = "Upcoming Events",
  defaultStudentId = ""
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [detailEvent, setDetailEvent] = useState(null);
  const [agendaDate, setAgendaDate] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [colorCycleIndex, setColorCycleIndex] = useState(0);
  const [plusActive, setPlusActive] = useState(false);
  const [exitEventId, setExitEventId] = useState(null);
  const [calendarPrefs, setCalendarPrefs] = useState(() => {
    const prefs = loadPreferences();
    return { weekStart: prefs.weekStart, defaultCalendarView: prefs.defaultCalendarView };
  });
  const maxVisible = useMaxVisibleEvents();
  const { showToast, flashEvent, highlightEventId } = useInteractionFeedback();
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const isMentorCalendar = role === "mentor" || mentorView;
  const { plan } = usePlanAccess();
  const {
    scheduleEventReminder,
    cancelEventReminder,
    scheduleMeeting,
    userCalendarEvents,
    persistCalendarItem,
    deleteCalendarItem,
    isMentorStudentView,
    isParentStudentView,
    mentorViewStudent,
    parentViewStudent,
    mentor
  } = useDashboardData();
  const createOptions = useMemo(() => {
    if (isMentorCalendar || isMentorStudentView) return CREATE_OPTIONS;
    if (plan === "basic") return TASK_ONLY_CREATE_OPTIONS;
    // Plus and Pro: Event (mentor review) + Task
    return CREATE_OPTIONS;
  }, [isMentorCalendar, isMentorStudentView, plan]);
  const activeStudent = mentorViewStudent || parentViewStudent || students.find((item) => item.id === defaultStudentId);
  const calendarRole = isMentorStudentView ? "mentor" : role;
  const isGuardianStudentView = isMentorStudentView || isParentStudentView;
  const calendarStudents = isGuardianStudentView && activeStudent ? [activeStudent] : students;
  const lockedStudentId = isGuardianStudentView ? activeStudent?.id : defaultStudentId;

  useEffect(() => {
    function syncCalendarPrefs() {
      const prefs = loadPreferences();
      setCalendarPrefs({
        weekStart: prefs.weekStart,
        defaultCalendarView: prefs.defaultCalendarView
      });
    }
    window.addEventListener("prelude-preferences-changed", syncCalendarPrefs);
    return () => window.removeEventListener("prelude-preferences-changed", syncCalendarPrefs);
  }, []);

  const handleSaveLocalEvent = useCallback(async (saved) => {
    if (isGuardianStudentView) return;
    const linkedStudent = calendarStudents.find((student) => student.id === saved.studentId);
    const enriched = (isMentorCalendar || isMentorStudentView) && saved.formVariant === "event"
      ? {
          ...saved,
          studentId: saved.studentId || lockedStudentId,
          studentName: saved.studentName || linkedStudent?.name || activeStudent?.name,
          shared: true,
          mentorOnly: false,
          category: saved.category || "mentor_meeting",
          status: "scheduled"
        }
      : isMentorStudentView && lockedStudentId
        ? {
            ...saved,
            studentId: saved.studentId || lockedStudentId,
            studentName: saved.studentName || activeStudent?.name,
            shared: saved.shared !== false,
            sharedWithStudent: saved.shared !== false
          }
        : saved;

    if (editDraft) {
      const nextItem = {
        ...enriched,
        id: editDraft.id,
        pillColor: enriched.pillColor || editDraft.pillColor,
        formVariant: editDraft.formVariant,
        calendarItemType: editDraft.calendarItemType ?? editDraft.formVariant,
        reminderMinutes: enriched.reminderMinutes ?? editDraft.reminderMinutes
      };
      const stored = await persistCalendarItem(nextItem, editDraft.id);
      scheduleEventReminder({
        id: nextItem.id,
        title: nextItem.title,
        start: nextItem.start,
        reminderMinutes: nextItem.reminderMinutes,
        formVariant: nextItem.formVariant
      });
      setEditDraft(null);
      showToast("Event updated");
      play(SOUND_EVENTS.SAVE_SUCCESS);
      flashEvent(`ev-${editDraft.id}`);
      if (isValidMeetingJoinUrl(stored?.zoomJoinUrl, stored?.meetingType)) {
        const normalized = normalizeCalendarEvent({ ...stored, userCreated: true }, { mentorView: isMentorCalendar || isMentorStudentView });
        if (normalized) setDetailEvent(normalized);
      }
      return stored;
    }

    const savedCategory = String(enriched.category || createDraft?.category || "").toLowerCase();
    const autoColor = isMentorStudentView
      ? (savedCategory.includes("deadline") ? "orange" : "green")
      : PILL_COLOR_CYCLE[colorCycleIndex % PILL_COLOR_CYCLE.length];
    const nextItem = {
      ...enriched,
      pillColor: enriched.pillColor || autoColor,
      formVariant: enriched.formVariant ?? createDraft?.formVariant ?? "event",
      calendarItemType: enriched.calendarItemType ?? createDraft?.formVariant ?? "event",
      reminderMinutes: enriched.reminderMinutes
    };
    const stored = await persistCalendarItem(nextItem);
    scheduleEventReminder({
      id: stored.id,
      title: stored.title,
      start: stored.start,
      reminderMinutes: stored.reminderMinutes,
      formVariant: stored.formVariant
    });
    if (!enriched.pillColor) setColorCycleIndex((index) => index + 1);
    setCreateDraft(null);
    showToast(isValidMeetingJoinUrl(stored?.zoomJoinUrl, stored?.meetingType) ? "Meeting scheduled" : "Event added to calendar");
    play(SOUND_EVENTS.CALENDAR_SUCCESS);
    flashEvent(`ev-${stored.id}`);
    setPlusActive(true);
    window.setTimeout(() => setPlusActive(false), 450);
    if (isValidMeetingJoinUrl(stored?.zoomJoinUrl, stored?.meetingType)) {
      const normalized = normalizeCalendarEvent({ ...stored, userCreated: true }, { mentorView: isMentorCalendar || isMentorStudentView });
      if (normalized) setDetailEvent(normalized);
    }
    return stored;
  }, [colorCycleIndex, createDraft, editDraft, isGuardianStudentView, isMentorCalendar, isMentorStudentView, lockedStudentId, activeStudent, persistCalendarItem, scheduleEventReminder, calendarStudents, showToast, play, SOUND_EVENTS, flashEvent]);

  const handleEditEvent = useCallback((modalEvent) => {
    const raw = findLocalEventRaw(modalEvent, userCalendarEvents);
    if (!raw) return;
    setDetailEvent(null);
    setEditDraft(raw);
  }, [userCalendarEvents]);

  const handleDeleteEvent = useCallback(async (modalEvent) => {
    const raw = findLocalEventRaw(modalEvent, userCalendarEvents);
    if (!raw) return;
    const label = raw.formVariant === "task" ? "task" : "event";
    if (!window.confirm(`Delete this ${label} from the calendar? This cannot be undone.`)) return;
    const flashKey = `ev-${raw.id}`;
    setExitEventId(flashKey);
    cancelEventReminder(raw.id);
    window.setTimeout(async () => {
      await deleteCalendarItem(raw.id);
      setExitEventId(null);
      setDetailEvent(null);
    }, 260);
  }, [cancelEventReminder, deleteCalendarItem, userCalendarEvents]);

  const allEvents = useMemo(() => {
    const merged = mergeEvents({
      deadlines,
      meetings,
      events: [...events, ...userCalendarEvents],
      mentorView: isMentorCalendar || isMentorStudentView
    });

    let result = merged;

    if ((isMentorCalendar || isMentorStudentView) && calendarStudents.length) {
      result = result.map((event) => {
        if (event.studentName) return event;
        const sid = event.studentId || event.raw?.studentId;
        const student = calendarStudents.find((item) => item.id === sid);
        return student ? { ...event, studentName: student.name } : event;
      });
    }

    if (studentFilter) {
      result = result.filter((event) => {
        const sid = event.studentId || event.raw?.studentId;
        if (!sid) return true;
        return sid === studentFilter;
      });
    }

    return result;
  }, [deadlines, meetings, events, userCalendarEvents, isMentorCalendar, isMentorStudentView, calendarStudents, studentFilter]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
  const weekdayLabels = useMemo(
    () => getWeekdayLabels(calendarPrefs.weekStart),
    [calendarPrefs.weekStart]
  );
  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, calendarPrefs.weekStart),
    [viewYear, viewMonth, calendarPrefs.weekStart]
  );
  const today = now.getDate();
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const preferredView = calendarPrefs.defaultCalendarView;
  const isMobileAgenda = maxVisible === 0;
  const showAgendaLayout = isMobileAgenda || preferredView === "agenda";
  const showWeekLayout = !isMobileAgenda && preferredView === "week";
  const showDayLayout = !isMobileAgenda && preferredView === "day";
  const focusDay = selectedDay ?? (isCurrentMonth ? today : 1);
  const weekDays = useMemo(() => {
    if (!showWeekLayout) return [];
    const anchor = new Date(viewYear, viewMonth, focusDay);
    const weekStartDate = getWeekStartDate(anchor, calendarPrefs.weekStart);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + index);
      return {
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        inCurrentMonth: date.getMonth() === viewMonth && date.getFullYear() === viewYear
      };
    });
  }, [showWeekLayout, viewYear, viewMonth, focusDay, calendarPrefs.weekStart]);
  const dayLayoutEvents = useMemo(() => {
    if (!showDayLayout) return [];
    return eventsForDay(allEvents, viewYear, viewMonth, focusDay);
  }, [showDayLayout, allEvents, viewYear, viewMonth, focusDay]);

  const shiftMonth = useCallback((delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setSelectedDay(null);
  }, [viewYear, viewMonth]);

  const goToToday = useCallback(() => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
  }, [now]);

  const openDayAgenda = useCallback((year, month, day) => {
    setSelectedDay(day);
    setAgendaDate(new Date(year, month, day));
  }, []);

  const agendaEvents = useMemo(() => {
    if (!agendaDate) return [];
    return eventsForDay(allEvents, agendaDate.getFullYear(), agendaDate.getMonth(), agendaDate.getDate());
  }, [agendaDate, allEvents]);

  const mobileAgendaDays = useMemo(() => {
    if (!showAgendaLayout) return [];
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const rows = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayEvents = eventsForDay(allEvents, viewYear, viewMonth, day);
      if (dayEvents.length) rows.push({ day, events: dayEvents });
    }
    return rows;
  }, [showAgendaLayout, allEvents, viewYear, viewMonth]);

  const showUpcomingInline = showUpcomingEvents && upcomingEventsPlacement === "inline";
  const showUpcomingExternal = showUpcomingEvents && upcomingEventsPlacement === "external" && upcomingEventsMountEl;
  const upcomingPanel = showUpcomingEvents ? (
    <UpcomingEventsPanel
      allEvents={allEvents}
      onEventSelect={setDetailEvent}
      title={upcomingTitle}
      mentorView={isMentorCalendar}
      mentorStudentView={isMentorStudentView}
      eventFilter={isMentorCalendar ? isMentorUpcomingMeeting : null}
    />
  ) : null;

  return (
    <div className={cn("dash-cal-visual", showUpcomingInline && "dash-cal-visual--with-upcoming")}>
      <div className="dash-cal-visual__glow" aria-hidden="true" />
      <article className="dash-cal-visual__card">
        <header className="dash-cal-visual__head">
          <div className="dash-cal-visual__head-title">
            <p className="dash-cal-visual__eyebrow">
              <CalendarDays className="h-4 w-4" /> Calendar
            </p>
            <h2 className="dash-cal-visual__title">{monthLabel}</h2>
            <div className="dash-cal-visual__create-row">
              {isGuardianStudentView ? (
                <p className="dash-cal-visual__readonly-note">Read-only student calendar</p>
              ) : (
                <CalendarCreateMenu onSelect={setCreateDraft} plusActive={plusActive} options={createOptions} />
              )}
            </div>
          </div>
          <div className="dash-cal-visual__controls">
            {showStudentFilter && students.length ? (
              <select
                className="dash-cal-visual__ctrl dash-cal-visual__student-filter"
                value={studentFilter || ""}
                onChange={(event) => onStudentFilterChange?.(event.target.value)}
                aria-label="Filter by student"
              >
                <option value="">All students</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" className="dash-cal-visual__ctrl" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="dash-cal-visual__ctrl dash-cal-visual__ctrl--today" onClick={goToToday}>
              Today
            </button>
            <button type="button" className="dash-cal-visual__ctrl" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        {showAgendaLayout ? (
          <div className="dash-cal-visual__mobile-agenda">
            {mobileAgendaDays.length ? (
              mobileAgendaDays.map(({ day, events: dayEvents }) => (
                <div
                  key={day}
                  className="dash-cal-visual__mobile-day"
                >
                  <button
                    type="button"
                    className="dash-cal-visual__mobile-day-trigger dash-cal-visual__mobile-day-label"
                    onClick={() => openDayAgenda(viewYear, viewMonth, day)}
                    aria-label={`Open ${new Date(viewYear, viewMonth, day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} agenda`}
                  >
                    {new Date(viewYear, viewMonth, day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </button>
                  <div className="dash-cal-visual__mobile-day-events">
                    {dayEvents.map((event) => (
                      <EventPill key={event.id} event={event} onSelect={setDetailEvent} mentorView={isMentorCalendar} mentorStudentView={isMentorStudentView} flashId={highlightEventId} exitId={exitEventId} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No events this month"
                description="Create an event or task to start building your schedule."
              />
            )}
          </div>
        ) : showDayLayout ? (
          <div className="dash-cal-visual__day-view">
            <h3 className="dash-cal-visual__day-view-title">
              {new Date(viewYear, viewMonth, focusDay).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
              })}
            </h3>
            {dayLayoutEvents.length ? (
              <div className="dash-cal-visual__mobile-day-events">
                {dayLayoutEvents.map((event) => (
                  <EventPill key={event.id} event={event} onSelect={setDetailEvent} mentorView={isMentorCalendar} mentorStudentView={isMentorStudentView} flashId={highlightEventId} exitId={exitEventId} />
                ))}
              </div>
            ) : (
              <p className="dash-cal-visual__agenda-empty">No events scheduled for this day.</p>
            )}
          </div>
        ) : showWeekLayout ? (
          <>
            <div className="dash-cal-visual__weekdays">
              {weekdayLabels.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="dash-cal-visual__grid dash-cal-visual__grid--week">
              {weekDays.map(({ year, month, day, inCurrentMonth }) => {
                const dayEvents = eventsForDay(allEvents, year, month, day);
                const visible = dayEvents.slice(0, maxVisible);
                const overflow = dayEvents.length - visible.length;
                const isToday =
                  year === now.getFullYear() && month === now.getMonth() && day === today;

                return (
                  <div
                    key={`${year}-${month}-${day}`}
                    className={cn(
                      "dash-cal-visual__day",
                      !inCurrentMonth && "dash-cal-visual__day--muted",
                      isToday && "dash-cal-visual__day--today"
                    )}
                  >
                    <button
                      type="button"
                      className="dash-cal-visual__day-trigger"
                      onClick={() => {
                        setViewYear(year);
                        setViewMonth(month);
                        setSelectedDay(day);
                        openDayAgenda(year, month, day);
                      }}
                      aria-label={`${new Date(year, month, day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                    >
                      <span className="dash-cal-visual__day-num">{day}</span>
                    </button>
                    <div className="dash-cal-visual__day-events">
                      {visible.map((event) => (
                        <EventPill key={event.id} event={event} onSelect={setDetailEvent} mentorView={isMentorCalendar} mentorStudentView={isMentorStudentView} flashId={highlightEventId} exitId={exitEventId} />
                      ))}
                      {overflow > 0 ? (
                        <button
                          type="button"
                          className="dash-cal-visual__more"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDayAgenda(year, month, day);
                          }}
                          aria-label={`Show ${overflow} more events`}
                        >
                          +{overflow} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="dash-cal-visual__weekdays">
              {weekdayLabels.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="dash-cal-visual__grid">
              {cells.map((day, index) => {
                if (!day) {
                  return <span key={`empty-${index}`} className="dash-cal-visual__day dash-cal-visual__day--empty" aria-hidden="true" />;
                }

                const dayEvents = eventsForDay(allEvents, viewYear, viewMonth, day);
                const visible = dayEvents.slice(0, maxVisible);
                const overflow = dayEvents.length - visible.length;
                const isToday = isCurrentMonth && day === today;
                const cellTone = !isToday ? dayCellTone(dayEvents) : null;

                return (
                  <div
                    key={`${viewYear}-${viewMonth}-${day}`}
                    className={cn(
                      "dash-cal-visual__day",
                      isToday && "dash-cal-visual__day--today",
                      cellTone && `dash-cal-visual__day--${cellTone}`
                    )}
                  >
                    <button
                      type="button"
                      className="dash-cal-visual__day-trigger"
                      onClick={() => openDayAgenda(viewYear, viewMonth, day)}
                      aria-label={`${new Date(viewYear, viewMonth, day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                    >
                      <span className="dash-cal-visual__day-num">{day}</span>
                    </button>
                    <div className="dash-cal-visual__day-events">
                      {visible.map((event) => (
                        <EventPill key={event.id} event={event} onSelect={setDetailEvent} mentorView={isMentorCalendar} mentorStudentView={isMentorStudentView} flashId={highlightEventId} exitId={exitEventId} />
                      ))}
                      {overflow > 0 ? (
                        <button
                          type="button"
                          className="dash-cal-visual__more"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDayAgenda(viewYear, viewMonth, day);
                          }}
                          aria-label={`Show ${overflow} more events on ${new Date(viewYear, viewMonth, day).toLocaleDateString()}`}
                        >
                          +{overflow} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </article>

      {showUpcomingInline ? upcomingPanel : null}
      {showUpcomingExternal ? createPortal(upcomingPanel, upcomingEventsMountEl) : null}

      {detailEvent ? (
        <CalendarEventDetailModal
          event={toDetailModalEvent(detailEvent, mentorName, calendarStudents, {
            mentorStudentView: isMentorStudentView
          })}
          role={calendarRole}
          mentorName={mentorName}
          studentName={detailEvent.studentName || calendarStudents.find((student) => student.id === detailEvent.studentId)?.name}
          students={calendarStudents}
          onClose={() => setDetailEvent(null)}
          onEdit={detailEvent.source === "local" ? handleEditEvent : undefined}
          onDelete={detailEvent.source === "local" && !isParentStudentView ? handleDeleteEvent : undefined}
        />
      ) : null}

      {agendaDate ? (
        <DayAgendaPanel
          date={agendaDate}
          events={agendaEvents}
          mentorView={isMentorCalendar || isMentorStudentView}
          mentorStudentView={isMentorStudentView}
          onClose={() => setAgendaDate(null)}
          onEventSelect={(event) => {
            setAgendaDate(null);
            setDetailEvent(event);
          }}
        />
      ) : null}

      <CalendarAddEventModal
        open={Boolean(createDraft || editDraft)}
        onClose={() => {
          setCreateDraft(null);
          setEditDraft(null);
        }}
        role={calendarRole}
        students={calendarStudents}
        defaultStudentId={lockedStudentId}
        initialCategory={editDraft?.category ?? createDraft?.category ?? "personal_task"}
        initialEvent={editDraft}
        modalTitle={
          editDraft
            ? editDraft.formVariant === "task"
              ? "Edit task"
              : "Edit event"
            : createDraft?.modalTitle ?? "Add event"
        }
        formVariant={editDraft?.formVariant ?? createDraft?.formVariant ?? "full"}
        submitLabel={editDraft ? (editDraft.formVariant === "task" ? "Save task" : "Save event") : undefined}
        meetingRequestMode={
          !isMentorCalendar &&
          !isGuardianStudentView &&
          calendarRole === "student" &&
          Boolean(createDraft?.formVariant === "event" && !editDraft) &&
          (plan === "plus" || plan === "pro")
        }
        onRequestMeeting={(payload) =>
          scheduleMeeting({
            ...payload,
            status: "pending",
            sessionCategory: "college-consulting",
            mentorId: mentor?.id || payload.mentorId,
            mentorUserId: mentor?.userId || mentor?.mentorUserId || payload.mentorUserId,
            title: payload.title || "Mentor session",
            pillColor: payload.pillColor || payload.calendarColor,
            reminderMinutes: payload.reminderMinutes
          })
        }
        onSave={handleSaveLocalEvent}
      />
    </div>
  );
}
