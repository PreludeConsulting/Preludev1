import { X, Video } from "lucide-react";

export default function MeetingDetailModal({ meeting, mentorName, studentName, role, onClose }) {
  if (!meeting) return null;

  const start = new Date(meeting.startTime);
  const end = new Date(meeting.endTime);
  const durationMin = Math.round((end - start) / 60000);
  const showJoin = meeting.zoomJoinUrl && meeting.meetingType === "zoom";

  return (
    <div className="dash-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="dash-modal paper-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal__head">
          <h2 className="dash-modal__title">{meeting.title}</h2>
          <button type="button" className="dash-icon-btn" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="dash-detail-list">
          <div><dt>Date</dt><dd>{start.toLocaleDateString()}</dd></div>
          <div><dt>Time</dt><dd>{start.toLocaleTimeString()} ({meeting.timeZone || "Local"})</dd></div>
          <div><dt>Duration</dt><dd>{durationMin} minutes</dd></div>
          <div><dt>Mentor</dt><dd>{mentorName || "—"}</dd></div>
          <div><dt>Student</dt><dd>{studentName || "—"}</dd></div>
          <div><dt>Type</dt><dd>{meeting.meetingType}</dd></div>
          <div><dt>Status</dt><dd>{meeting.status}</dd></div>
          {meeting.notes ? (
            <div><dt>Notes</dt><dd>{meeting.notes}</dd></div>
          ) : null}
          {showJoin ? (
            <div>
              <dt>Zoom</dt>
              <dd>
                <a href={meeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-link">
                  Student join link
                </a>
                {role === "mentor" && meeting.zoomHostUrl ? (
                  <a href={meeting.zoomHostUrl} target="_blank" rel="noopener noreferrer" className="dash-link dash-link--host">
                    Host link (mentor only)
                  </a>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
        {showJoin ? (
          <a href={meeting.zoomJoinUrl} className="dash-btn-primary w-full" target="_blank" rel="noopener noreferrer">
            <Video className="h-4 w-4" /> Join Zoom Meeting
          </a>
        ) : null}
      </div>
    </div>
  );
}
