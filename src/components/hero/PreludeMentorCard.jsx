import { cn } from "../../lib/utils.js";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { savePendingJourney } from "../../lib/authJourney.js";

const registerPath = `${import.meta.env.BASE_URL}register`.replace(/\/+/g, "/");

export default function PreludeMentorCard({ mentor, showAction = true, serviceId = "", planId = "" }) {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  function handleChoose() {
    const next = `/onboarding/match?mentor=${encodeURIComponent(mentor.id)}`;
    const journey = { next, mentorId: mentor.id, serviceId, planId };
    if (user) {
      window.location.assign(next);
      return;
    }
    savePendingJourney(journey);
    const params = new URLSearchParams({ next, mentor: mentor.id, ref: "preludematch" });
    if (serviceId) params.set("service", serviceId);
    if (planId) params.set("plan", planId);
    window.location.assign(`${registerPath}?${params.toString()}`);
  }

  return (
    <article className={cn("pm-mentor-card", mentor.bestMatch && "pm-mentor-card--best")}>
      <div className="pm-mentor-card__top">
        <div className="pm-mentor-card__avatar" aria-hidden="true">
          {mentor.initials}
        </div>
        <div className="pm-mentor-card__identity">
          <div className="pm-mentor-card__name-row">
            <h3 className="pm-mentor-card__name">{mentor.name}</h3>
            {mentor.bestMatch ? <span className="pm-mentor-card__badge">Best Match</span> : null}
          </div>
          <p className="pm-mentor-card__school">
            {mentor.school} · {mentor.major}
          </p>
        </div>
        <p className="pm-mentor-card__match">{mentor.matchPercent}% match</p>
      </div>

      <div className="pm-mentor-card__tags">
        {(mentor.tags || mentor.specialties || []).slice(0, 2).map((tag) => (
          <span key={tag} className="pm-mentor-card__tag">
            {tag}
          </span>
        ))}
      </div>

      <p className="pm-mentor-card__reason">{mentor.reason}</p>
      <p className="pm-mentor-card__availability">{mentor.availability}</p>

      {showAction ? (
        <button type="button" className="pm-btn pm-btn--primary pm-btn--block" onClick={handleChoose}>
          {mentor.bestMatch ? "View and book" : "View mentor"}
        </button>
      ) : null}
    </article>
  );
}
