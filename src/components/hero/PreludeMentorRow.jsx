import { cn } from "../../lib/utils.js";

export default function PreludeMentorRow({ mentor, onView, onBook }) {
  return (
    <article className={cn("pm-row", mentor.bestMatch && "pm-row--best")}>
      {mentor.bestMatch ? <span className="pm-row__badge">Best Match</span> : null}

      <div className="pm-row__identity">
        <div className="pm-row__avatar" aria-hidden="true">
          {mentor.initials}
        </div>
        <div>
          <h3 className="pm-row__name">{mentor.name}</h3>
          <p className="pm-row__school">{mentor.school}</p>
          <p className="pm-row__meta">
            {mentor.major} · {mentor.graduationYear}
          </p>
        </div>
      </div>

      <div className="pm-row__match">
        <p className="pm-row__percent">{mentor.matchPercent}% match</p>
        <div className="pm-row__tags">
          {(mentor.tags || mentor.specialties || []).slice(0, 2).map((tag) => (
            <span key={tag} className="pm-row__tag">
              {tag}
            </span>
          ))}
        </div>
        <p className="pm-row__reason">&ldquo;{mentor.reason}&rdquo;</p>
      </div>

      <div className="pm-row__actions">
        <p className="pm-row__availability">{mentor.availability}</p>
        <div className="pm-row__buttons">
          <button type="button" className="pm-btn pm-btn--ghost pm-btn--sm" onClick={onView}>
            View mentor
          </button>
          {mentor.bestMatch ? (
            <button type="button" className="pm-btn pm-btn--primary pm-btn--sm" onClick={onBook}>
              Book intro
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
