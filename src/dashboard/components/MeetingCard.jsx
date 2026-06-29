import { Video } from "lucide-react";
import { isJoinableMeeting } from "../../lib/zoomMeetingLinks.js";

function formatRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function MeetingCard({ meeting, mentorName, studentName, role, onSelect }) {
  const showJoin = isJoinableMeeting(meeting) && meeting.status !== "canceled";

  return (
    <article className="dash-meeting-card paper-card">
      <div className="dash-meeting-card__head">
        <h3 className="dash-meeting-card__title">{meeting.title}</h3>
        <span className="dash-badge">
          {meeting.meetingType === "google_meet" ? "Google Meet" : meeting.meetingType === "zoom" ? "Zoom" : "Meeting"}
        </span>
      </div>
      <p className="dash-meeting-card__meta">{formatRange(meeting.startTime, meeting.endTime)}</p>
      <p className="dash-meeting-card__people">
        {mentorName ? <>Mentor: {mentorName}</> : null}
        {studentName ? <> · Student: {studentName}</> : null}
      </p>
      <div className="dash-meeting-card__actions">
        {showJoin ? (
          <a href={meeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-btn-primary dash-btn-primary--sm">
            <Video className="h-4 w-4" aria-hidden="true" />
            Join Meeting
          </a>
        ) : null}
        {role === "mentor" && meeting.zoomHostUrl ? (
          <button type="button" className="dash-btn-secondary dash-btn-primary--sm" onClick={() => navigator.clipboard?.writeText(meeting.zoomJoinUrl || "")}>
            Copy link for student
          </button>
        ) : null}
        <button type="button" className="dash-btn-ghost" onClick={() => onSelect?.(meeting)}>
          Details
        </button>
      </div>
    </article>
  );
}
