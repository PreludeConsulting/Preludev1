import { cn } from "../../lib/utils.js";

const registerPath = `${import.meta.env.BASE_URL}register`.replace(/\/+/g, "/");

export default function PreludeMentorCard({ mentor, showAction = true }) {
  function handleChoose() {
    const params = new URLSearchParams({ mentor: mentor.id, ref: "preludematch" });
    window.location.href = `${registerPath}?${params.toString()}`;
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
        {mentor.tags.slice(0, 2).map((tag) => (
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
