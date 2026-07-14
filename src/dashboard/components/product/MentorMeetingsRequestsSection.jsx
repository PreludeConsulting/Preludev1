import { Video } from "lucide-react";
import MeetingRequestActions from "../MeetingRequestActions.jsx";

function RequestDetails({ request }) {
  const title = request.title || request.type || "Mentor session";
  const timeRange = [request.requestedStartTime, request.requestedEndTime].filter(Boolean).join(" – ");
  const when = request.requestedDate
    ? `${request.requestedDate}${timeRange ? ` · ${timeRange}` : ""}`
    : request.requestedTime;

  return (
    <span className="dash-upcoming-events__content">
      <span className="dash-upcoming-events__event-title">{request.studentName}</span>
      <span className="dash-upcoming-events__event-meta">
        <strong>{title}</strong>
        {when ? <> · {when}</> : null}
      </span>
      {request.notes ? <span className="dash-meetings-requests__notes">{request.notes}</span> : null}
    </span>
  );
}

export default function MentorMeetingsRequestsSection({ requests = [], studentFilter = "" }) {
  const visible = studentFilter
    ? requests.filter((request) => request.studentId === studentFilter)
    : requests;

  if (!visible.length) return null;

  return (
    <article className="dash-product-card dash-upcoming-events dash-meetings-requests" aria-label="Meeting requests">
      <header className="dash-upcoming-events__head">
        <h3 className="dash-upcoming-events__title">Meeting requests</h3>
        <p className="dash-upcoming-events__summary">{visible.length} waiting</p>
      </header>
      <ul className="dash-upcoming-events__list dash-meetings-requests__list">
        {visible.map((request) => (
          <li key={request.id} className="dash-meetings-requests__item">
            <div className="dash-upcoming-events__row dash-meetings-requests__row">
              <span className="dash-upcoming-events__marker dash-upcoming-events__marker--orange" aria-hidden="true" />
              <RequestDetails request={request} />
              <span className="dash-meetings-requests__icon" aria-hidden="true">
                <Video className="h-4 w-4" />
              </span>
            </div>
            <div className="dash-meetings-requests__actions">
              <MeetingRequestActions
                request={request}
                acceptClassName="dash-btn--sm dash-meetings-requests__accept"
                declineClassName="dash-btn--sm dash-meetings-requests__decline"
              />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
