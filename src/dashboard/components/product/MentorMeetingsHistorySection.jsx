function formatMeetingDate(value) {
  if (!value) return "Date TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function MentorMeetingsHistorySection({ meetings = [], studentFilter = "" }) {
  const now = Date.now();

  const pastMeetings = meetings
    .filter((meeting) => {
      if (meeting.status === "pending") return false;
      const start = new Date(meeting.startTime || meeting.start);
      if (Number.isNaN(start.getTime()) || start.getTime() >= now) return false;
      if (studentFilter && meeting.studentId !== studentFilter) return false;
      return true;
    })
    .sort((a, b) => new Date(b.startTime || b.start) - new Date(a.startTime || a.start))
    .slice(0, 5);

  if (!pastMeetings.length) return null;

  return (
    <article className="dash-product-card dash-upcoming-events dash-meetings-history" aria-label="Meeting history">
      <header className="dash-upcoming-events__head">
        <h3 className="dash-upcoming-events__title">Meeting history</h3>
        <p className="dash-upcoming-events__summary">{pastMeetings.length} recent</p>
      </header>
      <ul className="dash-upcoming-events__list">
        {pastMeetings.map((meeting) => (
          <li key={meeting.id}>
            <div className="dash-upcoming-events__row">
              <span className="dash-upcoming-events__marker dash-upcoming-events__marker--blue" aria-hidden="true" />
              <span className="dash-upcoming-events__content">
                <span className="dash-upcoming-events__event-title">
                  {meeting.studentName ? `${meeting.studentName} · ` : ""}
                  {meeting.title}
                </span>
                <span className="dash-upcoming-events__event-meta">{formatMeetingDate(meeting.startTime || meeting.start)}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
