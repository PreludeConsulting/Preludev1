import { motion } from "motion/react";
import { HERO_MENTOR_MOCK } from "../../data/heroMentorMatch.js";
import MentorMatchCard from "./MentorMatchCard.jsx";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

const registerPath = `${import.meta.env.BASE_URL}register`.replace(/\/+/g, "/");
const mentorsPath = `${import.meta.env.BASE_URL}mentors`.replace(/\/+/g, "/");

export default function MentorMatchResults({ reducedMotion, onRestart }) {
  return (
    <motion.div
      className="hero-mm-results"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="hero-mm-results__head">
        <PreludePigAvatar size="sm" animate="celebrate" reducedMotion={reducedMotion} />
        <div>
          <h2 className="hero-mm-results__title">Your top mentor matches are ready.</h2>
          <p className="hero-mm-results__sub">
            Prelude AI selected these mentors based on your goals, preferences, and current stage.
          </p>
        </div>
      </div>

      <div className="hero-mm-results__grid">
        {HERO_MENTOR_MOCK.map((mentor, i) => (
          <motion.div
            key={mentor.id}
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <MentorMatchCard
              mentor={mentor}
              reducedMotion={reducedMotion}
              onView={() => {
                window.location.href = mentorsPath;
              }}
              onBook={() => {
                window.location.href = registerPath;
              }}
            />
          </motion.div>
        ))}
      </div>

      <div className="hero-mm-results__footer">
        <button type="button" className="hero-mm-link-btn" onClick={onRestart}>
          Restart demo
        </button>
        <a className="hero-mm-link-btn" href={mentorsPath}>
          View all mentors
        </a>
        <a className="hero-mm-btn hero-mm-btn--primary hero-mm-btn--sm" href={registerPath}>
          Create your account to meet your mentor
        </a>
      </div>
    </motion.div>
  );
}
