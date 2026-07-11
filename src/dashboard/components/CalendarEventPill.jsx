import { EVENT_CATEGORY_COLORS } from "../data/placeholders.js";

const SHORT_TITLES = {
  "College List Strategy Session": "Mentor Meeting",
  "Scholarship & Essay Planning": "Mentor Meeting",
  "Draft personal statement": "Personal Statement",
  "Revise personal statement": "Personal Statement",
  "Update extracurricular activities list": "Update Activities",
  "Review scholarship opportunities": "Scholarship Deadline",
  "Maya Patel — Office hours": "Office Hours",
  "UC application opens": "UC Application",
  "Early action deadline": "Early Action",
  "Mentor planning block": "Planning Block",
  "Grad school application research": "Private Block"
};

export function compactEventTitle(title) {
  if (!title) return "";
  if (SHORT_TITLES[title]) return SHORT_TITLES[title];
  if (title.length <= 24) return title;
  return `${title.slice(0, 22)}…`;
}

export default function CalendarEventPill({ arg }) {
  const category = arg.event.extendedProps?.category;
  const color = EVENT_CATEGORY_COLORS[category] || "#7c6cff";
  const viewType = arg.view?.type || "";
  const title = compactEventTitle(arg.event.title);
  const fullTitle = arg.event.title;
  const showTime = viewType.includes("timeGrid") && arg.timeText;
  const tooltip = showTime ? `${fullTitle} · ${arg.timeText}` : fullTitle;

  return (
    <span
      className="fc-event-pill"
      style={{ "--fc-pill-color": color }}
      title={tooltip}
      aria-label={tooltip}
    >
      <span className="fc-event-pill__dot" aria-hidden="true" />
      {showTime ? <span className="fc-event-pill__time">{arg.timeText}</span> : null}
      <span className="fc-event-pill__title">{title}</span>
    </span>
  );
}
