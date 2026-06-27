import { Video } from "lucide-react";
import MeetingRequestActions from "../MeetingRequestActions.jsx";

function RequestTypeLabel({ type = "" }) {
  const match = type.match(/^(Zoom)(\s+.*)?$/i);
  if (!match) return type;

  return (
    <>
      <strong>{match[1]}</strong>
      {match[2] || ""}
    </>
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
              <div>
                <p className="dash-mentor-request-row__name">{request.studentName}</p>
                <p className="dash-mentor-request-row__meta">
                  {request.requestedTime} · <RequestTypeLabel type={request.type} />
                </p>
              </div>
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
