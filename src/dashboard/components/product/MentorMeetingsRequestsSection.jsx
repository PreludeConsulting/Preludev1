import { Video } from "lucide-react";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { PrimaryButton, SecondaryButton } from "../ui/index.jsx";

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

export default function MentorMeetingsRequestsSection({ requests = [], studentFilter = "" }) {
  const { acceptMeetingRequest, declineMeetingRequest } = useDashboardData();

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
              <span className="dash-upcoming-events__content">
                <span className="dash-upcoming-events__event-title">{request.studentName}</span>
                <span className="dash-upcoming-events__event-meta">
                  {request.requestedTime} · <RequestTypeLabel type={request.type} />
                </span>
              </span>
              <span className="dash-meetings-requests__icon" aria-hidden="true">
                <Video className="h-4 w-4" />
              </span>
            </div>
            <div className="dash-meetings-requests__actions">
              <PrimaryButton
                type="button"
                className="dash-btn--sm dash-meetings-requests__accept"
                onClick={() => acceptMeetingRequest(request)}
              >
                Accept
              </PrimaryButton>
              <SecondaryButton
                type="button"
                className="dash-btn--sm dash-meetings-requests__decline"
                onClick={() => declineMeetingRequest(request.id)}
              >
                Decline
              </SecondaryButton>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
