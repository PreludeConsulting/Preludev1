import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils.js";

function MatchPercent({ value, reducedMotion }) {
  const [display, setDisplay] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    let frame;
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);

  return <span className="hero-mm-mentor__match">{display}% match</span>;
}

export default function MentorMatchCard({ mentor, reducedMotion, onView, onBook }) {
  return (
    <motion.article
      className={cn("hero-mm-mentor", mentor.bestMatch && "hero-mm-mentor--best")}
      whileHover={reducedMotion ? undefined : { y: -4, scale: mentor.bestMatch ? 1.02 : 1.01 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
    >
      {mentor.bestMatch ? <span className="hero-mm-mentor__badge">Best Match</span> : null}
      <div className="hero-mm-mentor__head">
        <div className={cn("hero-mm-mentor__avatar", `bg-gradient-to-br ${mentor.accent}`)} aria-hidden="true">
          {mentor.initials}
        </div>
        <div>
          <h3 className="hero-mm-mentor__name">{mentor.name}</h3>
          <p className="hero-mm-mentor__school">{mentor.school}</p>
          <p className="hero-mm-mentor__meta">
            {mentor.major} · {mentor.graduationYear}
          </p>
        </div>
        <MatchPercent value={mentor.matchPercent} reducedMotion={reducedMotion} />
      </div>
      <div className="hero-mm-mentor__tags">
        {(mentor.tags || mentor.specialties || []).map((tag) => (
          <span key={tag} className="hero-mm-mentor__tag" title={tag}>
            {tag}
          </span>
        ))}
      </div>
      <p className="hero-mm-mentor__availability">{mentor.availability}</p>
      <p className="hero-mm-mentor__explain">{mentor.explanation}</p>
      <div className="hero-mm-mentor__actions">
        <button type="button" className="hero-mm-btn hero-mm-btn--ghost hero-mm-btn--sm" onClick={onView}>
          View mentor
        </button>
        {mentor.bestMatch ? (
          <button type="button" className="hero-mm-btn hero-mm-btn--primary hero-mm-btn--sm" onClick={onBook}>
            Book an intro session
          </button>
        ) : null}
      </div>
    </motion.article>
  );
}
