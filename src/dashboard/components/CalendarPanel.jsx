import { useCallback, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, PLACEHOLDER_EVENTS } from "../data/placeholders.js";
import IntegrationConnect from "./IntegrationConnect.jsx";
import { CalendarAddEventModal, CalendarEventDetailModal } from "./CalendarEventModals.jsx";
import CalendarEventPill from "./CalendarEventPill.jsx";
import { DashBadge, PrimaryButton, SecondaryButton } from "./ui/index.jsx";

const DEMO_SLUGS = { jordan: "demo-student-jordan", alex: "demo-student-alex" };

const VIEW_MAP = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
  agenda: "listWeek"
};

function filterEvents(events, role, studentId, studentFilter, showPrivate) {
  return events.filter((e) => {
    const isPrivate = e.mentorOnly || e.category === "mentor_private";
    if (role === "student") {
      if (isPrivate) return false;
      if (e.studentId && studentId && e.studentId !== studentId) return false;
      return true;
    }
    if (!showPrivate && isPrivate) return false;
    if (studentFilter && e.studentId && e.studentId !== studentFilter) return false;
    return true;
  });
}

function toFcEvent(item, students, mentorName) {
  const category = item.category || item.extendedProps?.category;
  const start = item.start || item.startTime;
  const end = item.end || item.endTime || start;
  const allDay = category?.includes("deadline") && (!end || start === end);
  const student = students.find((s) => s.id === item.studentId);

  return {
    id: String(item.id),
    title: item.title,
    start,
    end: allDay ? undefined : end,
    allDay,
    backgroundColor: EVENT_CATEGORY_COLORS[category] || "#7c6cff",
    borderColor: "transparent",
    classNames: isPrivateClass(item) ? ["fc-event--private"] : ["fc-event--shared"],
    extendedProps: {
      category,
      description: item.description || item.notes,
      zoomJoinUrl: item.zoomJoinUrl,
      meeting: item.meeting,
      studentId: item.studentId,
      mentorOnly: item.mentorOnly,
      meetingType: item.meetingType || item.meeting?.meetingType,
      studentName: student?.name,
      mentorName
    }
  };
}

function isPrivateClass(item) {
  return item.mentorOnly || item.category === "mentor_private";
}

export default function CalendarPanel({
  role,
  events: eventsProp = PLACEHOLDER_EVENTS,
  meetings = [],
  students = [],
  studentId = DEMO_SLUGS.jordan,
  mentorName = "Maya Patel",
  googleConnected,
  onConnectGoogle,
  onDisconnectGoogle,
  studentFilter,
  onStudentFilterChange,
  showStudentFilter = false,
  onEventSelect
}) {
  const calRef = useRef(null);
  const [view, setView] = useState("month");
  const [title, setTitle] = useState("");
  const [localEvents, setLocalEvents] = useState([]);
  const [showPrivate, setShowPrivate] = useState(true);
  const [detail, setDetail] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const mergedSource = useMemo(() => {
    const meetingEvents = meetings.map((m) => ({
      id: m.id,
      title: m.title,
      category: "mentor_meeting",
      start: m.startTime,
      end: m.endTime,
      studentId: m.studentId,
      zoomJoinUrl: m.zoomJoinUrl,
      meeting: m,
      description: m.notes,
      shared: true
    }));
    return [...eventsProp, ...meetingEvents, ...localEvents];
  }, [eventsProp, meetings, localEvents]);

  const filtered = useMemo(
    () => filterEvents(mergedSource, role, studentId, studentFilter, showPrivate),
    [mergedSource, role, studentId, studentFilter, showPrivate]
  );

  const fcEvents = useMemo(() => filtered.map((e) => toFcEvent(e, students, mentorName)), [filtered, students, mentorName]);

  const handleDatesSet = useCallback((arg) => {
    setTitle(arg.view.title);
  }, []);

  function getApi() {
    return calRef.current?.getApi();
  }

  function nav(action) {
    const api = getApi();
    if (!api) return;
    if (action === "prev") api.prev();
    if (action === "next") api.next();
    if (action === "today") api.today();
  }

  function changeView(v) {
    setView(v);
    getApi()?.changeView(VIEW_MAP[v]);
  }

  function onEventClick(info) {
    const ev = {
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      category: info.event.extendedProps.category,
      extendedProps: info.event.extendedProps
    };
    setDetail(ev);
    if (info.event.extendedProps.meeting) onEventSelect?.(info.event.extendedProps.meeting);
  }

  function handleSaveEvent(payload) {
    setLocalEvents((prev) => [...prev, payload]);
  }

  function resolveStudentName() {
    return detail?.extendedProps?.studentName || students.find((s) => s.id === detail?.extendedProps?.studentId)?.name;
  }

  return (
    <div className="dash-calendar dash-calendar--fc">
      <div className="dash-calendar__toolbar">
        <div className="dash-calendar__nav">
          <SecondaryButton type="button" className="dash-btn--sm" onClick={() => nav("prev")}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </SecondaryButton>
          <SecondaryButton type="button" className="dash-btn--sm" onClick={() => nav("today")}>Today</SecondaryButton>
          <SecondaryButton type="button" className="dash-btn--sm" onClick={() => nav("next")}>
            Next <ChevronRight className="h-4 w-4" />
          </SecondaryButton>
          <span className="dash-calendar__label">{title}</span>
        </div>

        <div className="dash-view-tabs">
          {[
            ["month", "Month"],
            ["week", "Week"],
            ["day", "Day"],
            ["agenda", "Agenda"]
          ].map(([v, label]) => (
            <button key={v} type="button" className={view === v ? "dash-view-tabs__active" : ""} onClick={() => changeView(v)}>
              {label}
            </button>
          ))}
        </div>

        <PrimaryButton type="button" className="dash-btn--sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Event
        </PrimaryButton>

        {showStudentFilter ? (
          <select className="dash-select" value={studentFilter || ""} onChange={(e) => onStudentFilterChange?.(e.target.value)}>
            <option value="">All students</option>
            <option value={DEMO_SLUGS.jordan}>Jordan Lee</option>
            <option value={DEMO_SLUGS.alex}>Alex Kim</option>
          </select>
        ) : null}

        {role === "mentor" ? (
          <label className="dash-check-label dash-calendar__private-toggle">
            <input type="checkbox" checked={showPrivate} onChange={(e) => setShowPrivate(e.target.checked)} />
            Show private events
          </label>
        ) : null}
      </div>

      <IntegrationConnect
        label="Google Calendar"
        connectLabel="Connect Google Calendar"
        connected={googleConnected}
        onConnect={onConnectGoogle}
        onDisconnect={onDisconnectGoogle}
        description="Sync Prelude meetings and deadlines when connected."
      />

      {role === "mentor" ? (
        <div className="dash-calendar-legend">
          <DashBadge variant="lavender">Shared with students</DashBadge>
          <DashBadge variant="soft">Private mentor events</DashBadge>
        </div>
      ) : null}

      <div className="dash-calendar__fc-wrap">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={VIEW_MAP[view]}
          headerToolbar={false}
          events={fcEvents}
          eventClick={onEventClick}
          datesSet={handleDatesSet}
          height="auto"
          dayMaxEvents={3}
          moreLinkText={(n) => `+${n} more`}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          nowIndicator
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          listDayFormat={{ weekday: "long", month: "long", day: "numeric" }}
          eventContent={(arg) => <CalendarEventPill arg={arg} />}
        />
      </div>

      {detail ? (
        <CalendarEventDetailModal
          event={detail}
          role={role}
          mentorName={mentorName}
          studentName={resolveStudentName()}
          students={students}
          onClose={() => setDetail(null)}
          onDelete={() => setDetail(null)}
        />
      ) : null}

      <CalendarAddEventModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        role={role}
        students={students}
        onSave={handleSaveEvent}
      />
    </div>
  );
}
