import { motion } from "motion/react";
import { PRELUDE_MATCH_MENTORS } from "../../data/preludeMatchMentors.js";
import PreludeMentorCard from "./PreludeMentorCard.jsx";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

export default function PreludeMatchResults({ reducedMotion, onRestart }) {
  return (
    <div className="pm-results">
      <header className="pm-results__header">
        <PreludePigAvatar variant="results" motion="celebrate" label="" />
        <div>
          <h2 className="pm-results__title">Your mentor matches are ready.</h2>
          <p className="pm-results__sub">
            Selected around your goals, interests, and preferred support style.
          </p>
        </div>
        {import.meta.env.DEV ? (
          <button
            type="button"
            className="pm-results__dev-restart"
            onClick={onRestart}
            aria-label="Restart demo (development only)"
            title="Restart demo"
          >
            ↺
          </button>
        ) : null}
      </header>

      <div className="pm-results__scroll">
        {PRELUDE_MATCH_MENTORS.map((mentor, index) => (
          <motion.div
            key={mentor.id}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
          >
            <PreludeMentorCard mentor={mentor} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
