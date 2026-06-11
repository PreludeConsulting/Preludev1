import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { compactEventTitle } from "../CalendarEventPill.jsx";
import { CalendarAddEventModal, CalendarEventDetailModal } from "../CalendarEventModals.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { EVENT_CATEGORY_LABELS } from "../../data/placeholders.js";
import { Modal, SecondaryButton } from "../ui/index.jsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EXCLUDED_EVENT_PATTERN = /office\s*hours|update\s+(extracurricular\s+)?activities(\s+list)?/i;

const CREATE_OPTIONS = [
  { id: "event", label: "Event", category: "mentor_meeting", modalTitle: "Create event", formVariant: "event" },
  { id: "task", label: "Task", category: "personal_task", modalTitle: "Create task", formVariant: "task" }
];

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

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
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

function resolvePillTone(event) {
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

function normalizeMeeting(meeting) {
  const date = parseDate(meeting.startTime);
  if (!date) return null;

  return withItemKind({
    id: `mt-${meeting.id}`,
    title: meeting.title,
    date,
    endDate: parseDate(meeting.endTime),
    type: "mentor",
    allDay: false,
    description: meeting.notes,
    zoomJoinUrl: meeting.zoomJoinUrl,
    meeting,
    colorTone: resolveSamplePillTone(meeting.title),
    source: "meeting",
    raw: meeting
  });
}

function normalizeCalendarEvent(event) {
  if (event.mentorOnly || event.category === "mentor_private" || event.category === "mentor_availability") return null;

  const date = parseDate(event.start || event.startTime);
  if (!date) return null;

  const endDate = parseDate(event.end || event.endTime);
  const isUserCreated = Boolean(event.pillColor) || String(event.id).startsWith("evt-");

  return withItemKind({
    id: `ev-${event.id}`,
    title: event.title,
    date,
    endDate,
    type: mapCategoryToType(event.category),
    allDay: !endDate || date.toDateString() === endDate.toDateString(),
    description: event.description || event.notes,
    zoomJoinUrl: event.zoomJoinUrl,
    meeting: event.meeting,
    colorTone: event.pillColor || resolveSamplePillTone(event.title),
    formVariant: event.formVariant,
    calendarItemType: event.calendarItemType,
    category: event.category,
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

function mergeEvents({ deadlines = [], meetings = [], events = [] }) {
  const merged = [
    ...deadlines.map(normalizeDeadline).filter(Boolean),
    ...meetings.map(normalizeMeeting).filter(Boolean),
    ...events.map(normalizeCalendarEvent).filter(Boolean)
  ];

  const byKey = new Map();
  merged.forEach((item) => {
    const key = `${item.date.toDateString()}::${item.title}`;
    if (!byKey.has(key)) byKey.set(key, item);
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

function toDetailModalEvent(event, mentorName) {
  const end = event.endDate || event.date;
  const category = resolveCategory(event);

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
      meetingType: event.raw?.meetingType,
      mentorName,
      manageable: event.source === "local"
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

function UpcomingEventRow({ event, onSelect }) {
  const tone = resolvePillTone(event);

  return (
    <li>
      <button type="button" className="dash-upcoming-events__row" onClick={() => onSelect(event)}>
        <span
          className={cn("dash-upcoming-events__marker", `dash-upcoming-events__marker--${tone}`)}
          aria-hidden="true"
        />
        <span className="dash-upcoming-events__content">
          <span className="dash-upcoming-events__event-title">{compactEventTitle(event.title)}</span>
          <span className="dash-upcoming-events__event-meta">{formatEventTime(event)}</span>
        </span>
      </button>
    </li>
  );
}

function UpcomingEventsColumn({ label, events, onEventSelect }) {
  return (
    <section className="dash-upcoming-events__column">
      <h4 className="dash-upcoming-events__column-label">{label}</h4>
      {events.length ? (
        <ul className="dash-upcoming-events__list">
          {events.map((event) => (
            <UpcomingEventRow key={event.id} event={event} onSelect={onEventSelect} />
          ))}
        </ul>
      ) : (
        <p className="dash-upcoming-events__column-empty">No events scheduled</p>
      )}
    </section>
  );
}

function UpcomingEventsPanel({ allEvents, onEventSelect }) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayEvents = eventsForCalendarDate(allEvents, now);
  const tomorrowEvents = eventsForCalendarDate(allEvents, tomorrow);
  const hasEvents = todayEvents.length > 0 || tomorrowEvents.length > 0;

  return (
    <article className="dash-product-card dash-upcoming-events">
      <header className="dash-upcoming-events__head">
        <h3 className="dash-upcoming-events__title">Upcoming Events</h3>
        {hasEvents ? (
          <p className="dash-upcoming-events__summary">
            {todayEvents.length} Today · {tomorrowEvents.length} Tomorrow
          </p>
        ) : null}
      </header>
      {hasEvents ? (
        <div className="dash-upcoming-events__columns">
          <UpcomingEventsColumn label="Today" events={todayEvents} onEventSelect={onEventSelect} />
          <UpcomingEventsColumn label="Tomorrow" events={tomorrowEvents} onEventSelect={onEventSelect} />
        </div>
      ) : (
        <p className="dash-upcoming-events__empty">No upcoming events.</p>
      )}
    </article>
  );
}

function EventPill({ event, onSelect }) {
  const category = resolveCategory(event);
  const tone = resolvePillTone(event);
  const label = EVENT_CATEGORY_LABELS[category] || category;

  return (
    <button
      type="button"
      className={cn("dash-cal-visual__pill", `dash-cal-visual__pill--${tone}`)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
      aria-label={`${event.title}, ${label}, ${formatEventTime(event)}`}
    >
      <span className="dash-cal-visual__pill-label">{compactEventTitle(event.title)}</span>
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

function CalendarCreateMenu({ onSelect }) {
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
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>Create</span>
        <ChevronDown className={cn("dash-cal-visual__create-chevron", open && "dash-cal-visual__create-chevron--open")} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="dash-cal-visual__create-menu" role="menu">
          {CREATE_OPTIONS.map((option) => (
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

function DayAgendaPanel({ date, events, onClose, onEventSelect }) {
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
            const tone = resolvePillTone(event);
            return (
              <li key={event.id}>
                <button type="button" className="dash-cal-visual__agenda-item" onClick={() => onEventSelect(event)}>
                  <span className={cn("dash-cal-visual__pill", `dash-cal-visual__pill--${tone}`, "dash-cal-visual__agenda-pill")}>
                    {compactEventTitle(event.title)}
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
  mentorName = "Maya Patel",
  showUpcomingEvents = false
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [detailEvent, setDetailEvent] = useState(null);
  const [agendaDate, setAgendaDate] = useState(null);
  const [localEvents, setLocalEvents] = useState([]);
  const [createDraft, setCreateDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [colorCycleIndex, setColorCycleIndex] = useState(0);
  const maxVisible = useMaxVisibleEvents();
  const { scheduleEventReminder, cancelEventReminder } = useDashboardData();

  const handleSaveLocalEvent = useCallback((saved) => {
    if (editDraft) {
      const nextItem = {
        ...saved,
        id: editDraft.id,
        pillColor: saved.pillColor || editDraft.pillColor,
        formVariant: editDraft.formVariant,
        calendarItemType: editDraft.calendarItemType ?? editDraft.formVariant,
        reminderMinutes: saved.reminderMinutes ?? editDraft.reminderMinutes
      };
      setLocalEvents((prev) => prev.map((item) => (item.id === editDraft.id ? nextItem : item)));
      scheduleEventReminder({
        id: nextItem.id,
        title: nextItem.title,
        start: nextItem.start,
        reminderMinutes: nextItem.reminderMinutes,
        formVariant: nextItem.formVariant
      });
      setEditDraft(null);
      return;
    }

    const autoColor = PILL_COLOR_CYCLE[colorCycleIndex % PILL_COLOR_CYCLE.length];
    const nextItem = {
      ...saved,
      pillColor: saved.pillColor || autoColor,
      formVariant: saved.formVariant ?? createDraft?.formVariant ?? "event",
      calendarItemType: saved.calendarItemType ?? createDraft?.formVariant ?? "event",
      reminderMinutes: saved.reminderMinutes
    };
    setLocalEvents((prev) => [...prev, nextItem]);
    scheduleEventReminder({
      id: nextItem.id,
      title: nextItem.title,
      start: nextItem.start,
      reminderMinutes: nextItem.reminderMinutes,
      formVariant: nextItem.formVariant
    });
    if (!saved.pillColor) setColorCycleIndex((index) => index + 1);
    setCreateDraft(null);
  }, [colorCycleIndex, createDraft, editDraft, scheduleEventReminder]);

  const handleEditEvent = useCallback((modalEvent) => {
    const raw = findLocalEventRaw(modalEvent, localEvents);
    if (!raw) return;
    setDetailEvent(null);
    setEditDraft(raw);
  }, [localEvents]);

  const handleDeleteEvent = useCallback((modalEvent) => {
    const raw = findLocalEventRaw(modalEvent, localEvents);
    if (!raw) return;
    cancelEventReminder(raw.id);
    setLocalEvents((prev) => prev.filter((item) => item.id !== raw.id));
    setDetailEvent(null);
  }, [cancelEventReminder, localEvents]);

  const allEvents = useMemo(
    () => mergeEvents({ deadlines, meetings, events: [...events, ...localEvents] }),
    [deadlines, meetings, events, localEvents]
  );

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
  const cells = buildMonthGrid(viewYear, viewMonth);
  const today = now.getDate();
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const isMobileAgenda = maxVisible === 0;

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
    if (!isMobileAgenda) return [];
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const rows = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayEvents = eventsForDay(allEvents, viewYear, viewMonth, day);
      if (dayEvents.length) rows.push({ day, events: dayEvents });
    }
    return rows;
  }, [isMobileAgenda, allEvents, viewYear, viewMonth]);

  return (
    <div className={cn("dash-cal-visual", showUpcomingEvents && "dash-cal-visual--with-upcoming")}>
      <div className="dash-cal-visual__glow" aria-hidden="true" />
      <article className="dash-cal-visual__card">
        <header className="dash-cal-visual__head">
          <div className="dash-cal-visual__head-title">
            <p className="dash-cal-visual__eyebrow">
              <CalendarDays className="h-4 w-4" /> Calendar
            </p>
            <h2 className="dash-cal-visual__title">{monthLabel}</h2>
            <div className="dash-cal-visual__create-row">
              <CalendarCreateMenu onSelect={setCreateDraft} />
            </div>
          </div>
          <div className="dash-cal-visual__controls">
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

        {isMobileAgenda ? (
          <div className="dash-cal-visual__mobile-agenda">
            {mobileAgendaDays.length ? (
              mobileAgendaDays.map(({ day, events: dayEvents }) => (
                <button
                  key={day}
                  type="button"
                  className="dash-cal-visual__mobile-day"
                  onClick={() => openDayAgenda(viewYear, viewMonth, day)}
                >
                  <span className="dash-cal-visual__mobile-day-label">
                    {new Date(viewYear, viewMonth, day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <div className="dash-cal-visual__mobile-day-events">
                    {dayEvents.map((event) => (
                      <EventPill key={event.id} event={event} onSelect={setDetailEvent} />
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <p className="dash-cal-visual__agenda-empty">No events this month.</p>
            )}
          </div>
        ) : (
          <>
            <div className="dash-cal-visual__weekdays">
              {WEEKDAYS.map((day) => (
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
                const isSelected = selectedDay === day;
                const cellTone = !isToday && !isSelected ? dayCellTone(dayEvents) : null;

                return (
                  <button
                    key={`${viewYear}-${viewMonth}-${day}`}
                    type="button"
                    className={cn(
                      "dash-cal-visual__day",
                      isToday && "dash-cal-visual__day--today",
                      isSelected && "dash-cal-visual__day--selected",
                      cellTone && `dash-cal-visual__day--${cellTone}`
                    )}
                    onClick={() => openDayAgenda(viewYear, viewMonth, day)}
                    aria-label={`${new Date(viewYear, viewMonth, day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                  >
                    <span className="dash-cal-visual__day-num">{day}</span>
                    <div className="dash-cal-visual__day-events">
                      {visible.map((event) => (
                        <EventPill key={event.id} event={event} onSelect={setDetailEvent} />
                      ))}
                      {overflow > 0 ? (
                        <span
                          className="dash-cal-visual__more"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDayAgenda(viewYear, viewMonth, day);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              openDayAgenda(viewYear, viewMonth, day);
                            }
                          }}
                        >
                          +{overflow} more
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

      </article>

      {showUpcomingEvents ? (
        <UpcomingEventsPanel allEvents={allEvents} onEventSelect={setDetailEvent} />
      ) : null}

      {detailEvent ? (
        <CalendarEventDetailModal
          event={toDetailModalEvent(detailEvent, mentorName)}
          role="student"
          mentorName={mentorName}
          onClose={() => setDetailEvent(null)}
          onEdit={detailEvent.source === "local" ? handleEditEvent : undefined}
          onDelete={detailEvent.source === "local" ? handleDeleteEvent : undefined}
        />
      ) : null}

      {agendaDate ? (
        <DayAgendaPanel
          date={agendaDate}
          events={agendaEvents}
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
        role="student"
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
        onSave={handleSaveLocalEvent}
      />
    </div>
  );
}
