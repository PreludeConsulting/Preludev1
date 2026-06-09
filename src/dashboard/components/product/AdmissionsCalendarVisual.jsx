import { CalendarDays, ChevronLeft, ChevronRight, FileText, GraduationCap, Video } from "lucide-react";
import { cn } from "../../../lib/utils.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_HIGHLIGHTS = {
  12: "essay",
  18: "essay",
  28: "application"
};

const FLOATING_EVENTS = [
  {
    id: "fe-1",
    title: "Personal Statement Draft",
    date: "Apr 12",
    icon: FileText,
    tone: "purple",
    style: { top: "8%", right: "-4%" }
  },
  {
    id: "fe-2",
    title: "Georgia Tech Supplement",
    date: "Apr 18",
    icon: GraduationCap,
    tone: "blue",
    style: { bottom: "18%", right: "-6%" }
  },
  {
    id: "fe-3",
    title: "Mentor Meeting",
    date: "Thu 4:00 PM",
    icon: Video,
    tone: "violet",
    style: { bottom: "6%", left: "-2%" }
  }
];

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

export default function AdmissionsCalendarVisual({ deadlines = [], meetings = [] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const cells = buildMonthGrid(year, month);
  const today = now.getDate();

  const highlightMap = { ...DEFAULT_HIGHLIGHTS };
  deadlines.forEach((d) => {
    const parsed = new Date(d.dueDate);
    if (!Number.isNaN(parsed.getTime()) && parsed.getMonth() === month && parsed.getFullYear() === year) {
      highlightMap[parsed.getDate()] = d.category?.toLowerCase().includes("essay") ? "essay" : "deadline";
    }
  });

  const nextMeeting = meetings[0];
  const floating = FLOATING_EVENTS.map((item, index) => {
    if (index === 2 && nextMeeting?.startTime) {
      const start = new Date(nextMeeting.startTime);
      return {
        ...item,
        title: nextMeeting.title || item.title,
        date: `${start.toLocaleDateString(undefined, { weekday: "short" })} ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
      };
    }
    return item;
  });

  return (
    <div className="dash-cal-visual">
      <div className="dash-cal-visual__glow" aria-hidden="true" />
      <article className="dash-cal-visual__card">
        <header className="dash-cal-visual__head">
          <div>
            <p className="dash-cal-visual__eyebrow">
              <CalendarDays className="h-4 w-4" /> Admissions timeline
            </p>
            <h2 className="dash-cal-visual__title">{monthLabel}</h2>
          </div>
          <div className="dash-cal-visual__controls">
            <button type="button" className="dash-cal-visual__ctrl" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="dash-cal-visual__ctrl" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="dash-cal-visual__weekdays">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="dash-cal-visual__grid">
          {cells.map((day, index) => (
            <span
              key={`${day ?? "e"}-${index}`}
              className={cn(
                "dash-cal-visual__day",
                day === today && "dash-cal-visual__day--today",
                day && highlightMap[day] && `dash-cal-visual__day--${highlightMap[day]}`
              )}
            >
              {day ?? ""}
            </span>
          ))}
        </div>

        <div className="dash-cal-visual__legend">
          <span><i className="dash-cal-visual__dot dash-cal-visual__dot--essay" /> Essay deadline</span>
          <span><i className="dash-cal-visual__dot dash-cal-visual__dot--deadline" /> Application</span>
          <span><i className="dash-cal-visual__dot dash-cal-visual__dot--meeting" /> Meeting</span>
        </div>
      </article>

      {floating.map(({ id, title, date, icon: Icon, tone, style }) => (
        <div key={id} className={cn("dash-cal-visual__float", `dash-cal-visual__float--${tone}`)} style={style}>
          <span className="dash-cal-visual__float-icon">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="dash-cal-visual__float-title">{title}</p>
            <p className="dash-cal-visual__float-date">{date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
