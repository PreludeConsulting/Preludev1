import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { compactEventTitle } from "../CalendarEventPill.jsx";
import { CalendarAddEventModal, CalendarEventDetailModal } from "../CalendarEventModals.jsx";
import { EVENT_CATEGORY_LABELS } from "../../data/placeholders.js";
import { Modal, SecondaryButton } from "../ui/index.jsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_TONE = {
  essay_deadline: "essay",
  application_deadline: "application",
  mentor_meeting: "meeting",
  scholarship_deadline: "financial",
  personal_task: "essay"
};

const EXCLUDED_EVENT_PATTERN = /office\s*hours|update\s+(extracurricular\s+)?activities(\s+list)?/i;

const CREATE_OPTIONS = [
  { id: "event", label: "Event", category: "personal_task", modalTitle: "Create event", formVariant: "event" },
  { id: "task", label: "Task", category: "personal_task", modalTitle: "Create task", formVariant: "task" }
];

const CREATED_EVENT_COLORS = ["orange", "green", "pink", "blue"];

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
  if (event.category && CATEGORY_TONE[event.category]) return event.category;
  return TYPE_TO_CATEGORY[event.type] || "application_deadline";
}

function resolvePillTone(event) {
  if (event.colorTone) return event.colorTone;
  return CATEGORY_TONE[resolveCategory(event)] || "application";
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
  return {
    id: `dl-${deadline.id}`,
    title: deadline.title,
    date,
    endDate: null,
    type,
    allDay: true,
    description: `${deadline.category || "Deadline"}${deadline.priority ? ` · ${deadline.priority} priority` : ""}`,
    source: "deadline",
    raw: deadline
  };
}

function normalizeMeeting(meeting) {
  const date = parseDate(meeting.startTime);
  if (!date) return null;

  return {
    id: `mt-${meeting.id}`,
    title: meeting.title,
    date,
    endDate: parseDate(meeting.endTime),
    type: "mentor",
    allDay: false,
    description: meeting.notes,
    zoomJoinUrl: meeting.zoomJoinUrl,
    meeting,
    source: "meeting",
    raw: meeting
  };
}

function normalizeCalendarEvent(event) {
  if (event.mentorOnly || event.category === "mentor_private" || event.category === "mentor_availability") return null;

  const date = parseDate(event.start || event.startTime);
  if (!date) return null;

  const endDate = parseDate(event.end || event.endTime);
  const isUserCreated = Boolean(event.pillColor) || String(event.id).startsWith("evt-");

  return {
    id: `ev-${event.id}`,
    title: event.title,
    date,
    endDate,
    type: mapCategoryToType(event.category),
    allDay: !endDate || date.toDateString() === endDate.toDateString(),
    description: event.description || event.notes,
    zoomJoinUrl: event.zoomJoinUrl,
    meeting: event.meeting,
    colorTone: event.pillColor || null,
    source: isUserCreated ? "local" : "event",
    raw: event
  };
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

function highlightToneForDay(dayEvents) {
  if (!dayEvents.length) return null;
  if (dayEvents.some((e) => e.type === "essay")) return "essay";
  if (dayEvents.some((e) => e.type === "mentor")) return "meeting";
  if (dayEvents.some((e) => e.type === "application")) return "application";
  return "deadline";
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
  mentorName = "Maya Patel"
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

  const handleSaveLocalEvent = useCallback((saved) => {
    if (editDraft) {
      setLocalEvents((prev) =>
        prev.map((item) =>
          item.id === editDraft.id
            ? {
                ...saved,
                id: editDraft.id,
                pillColor: editDraft.pillColor,
                formVariant: editDraft.formVariant
              }
            : item
        )
      );
      setEditDraft(null);
      return;
    }

    setLocalEvents((prev) => [
      ...prev,
      {
        ...saved,
        pillColor: CREATED_EVENT_COLORS[colorCycleIndex % CREATED_EVENT_COLORS.length],
        formVariant: createDraft?.formVariant ?? "event"
      }
    ]);
    setColorCycleIndex((index) => index + 1);
    setCreateDraft(null);
  }, [colorCycleIndex, createDraft, editDraft]);

  const handleEditEvent = useCallback((modalEvent) => {
    const raw = findLocalEventRaw(modalEvent, localEvents);
    if (!raw) return;
    setDetailEvent(null);
    setEditDraft(raw);
  }, [localEvents]);

  const handleDeleteEvent = useCallback((modalEvent) => {
    const raw = findLocalEventRaw(modalEvent, localEvents);
    if (!raw) return;
    setLocalEvents((prev) => prev.filter((item) => item.id !== raw.id));
    setDetailEvent(null);
  }, [localEvents]);

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
    <div className="dash-cal-visual">
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
                const tone = highlightToneForDay(dayEvents);

                return (
                  <button
                    key={`${viewYear}-${viewMonth}-${day}`}
                    type="button"
                    className={cn(
                      "dash-cal-visual__day",
                      isToday && "dash-cal-visual__day--today",
                      isSelected && "dash-cal-visual__day--selected",
                      tone && `dash-cal-visual__day--${tone}`
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
