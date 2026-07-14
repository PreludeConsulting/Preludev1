import { Video } from "lucide-react";
import MeetingRequestActions from "../MeetingRequestActions.jsx";

function RequestDetails({ request }) {
  const title = request.title || request.type || "Mentor session";
  const timeRange = [request.requestedStartTime, request.requestedEndTime].filter(Boolean).join(" – ");
  const when = request.requestedDate
    ? `${request.requestedDate}${timeRange ? ` · ${timeRange}` : ""}`
    : request.requestedTime;

  return (
    <div>
      <p className="dash-mentor-request-row__name">{request.studentName}</p>
      <p className="dash-mentor-request-row__meta">
        <strong>{title}</strong>
        {when ? <> · {when}</> : null}
      </p>
      {request.notes ? <p className="dash-mentor-request-row__notes">{request.notes}</p> : null}
    </div>
  );
}

export default function MentorPendingRequestsPanel({ requests }) {
  if (!requests.length) return null;

  return (
    <article className="dash-product-card dash-product-card--mentor-requests" aria-label="Meeting requests">
      <header className="dash-product-card__head dash-mentor-requests-panel__head">
        <div>
          <p className="dash-product-card__eyebrow">Requests</p>
          <h3 className="dash-product-card__title">Meeting requests</h3>
        </div>
        <span className="dash-mentor-requests-panel__count">{requests.length} waiting</span>
      </header>
      <div className="dash-mentor-requests-panel__list">
        {requests.map((request) => (
          <article key={request.id} className="dash-mentor-request-row">
            <div className="dash-mentor-request-row__main">
              <span className="dash-mentor-request-row__icon" aria-hidden="true">
                <Video className="h-4 w-4" />
              </span>
              <RequestDetails request={request} />
            </div>
            <div className="dash-mentor-request-row__actions">
              <MeetingRequestActions
                request={request}
                acceptClassName="dash-btn--sm dash-mentor-request-row__accept"
                declineClassName="dash-btn--sm dash-mentor-request-row__decline"
              />
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}
