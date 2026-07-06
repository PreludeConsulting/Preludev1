import { motion } from "motion/react";
import { PRELUDE_MATCH_MENTORS } from "../../data/preludeMatchMentors.js";
import PreludeMentorCard from "./PreludeMentorCard.jsx";
import PreludePigAvatar from "./PreludePigAvatar.jsx";
import { HERO_RESULT_PAYOFF } from "./preludeMatchDemoContent.js";

export default function PreludeMatchResults({ reducedMotion, onRestart, matchSummary = "" }) {
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

      {matchSummary ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm leading-6 text-foreground">
          <strong className="mb-1 block">Mentor-match summary</strong>
          {matchSummary}
        </div>
      ) : null}

      <div className="pm-results__scroll">
        <motion.section
          className="pm-results__payoff"
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          <div className="pm-results__payoff-head">
            <div>
              <p>Student dashboard</p>
              <h3>{HERO_RESULT_PAYOFF.title}</h3>
            </div>
            <strong>+{HERO_RESULT_PAYOFF.coinsEarned} coins</strong>
          </div>
          <p className="pm-results__payoff-copy">{HERO_RESULT_PAYOFF.subtitle}</p>

          <div className="pm-results__task-list" aria-label="First dashboard tasks">
            {HERO_RESULT_PAYOFF.tasks.map((task) => (
              <span key={task.label}>
                <b>{task.label}</b>
                <small>{task.status}</small>
                <em>+{task.coins} coins</em>
              </span>
            ))}
          </div>

          <div className="pm-results__reward-row" aria-label="Reward targets">
            {HERO_RESULT_PAYOFF.rewards.map((reward) => (
              <article key={reward.title}>
                <span>{reward.label}</span>
                <strong>{reward.title}</strong>
                <small>{reward.coins} coins</small>
              </article>
            ))}
          </div>
        </motion.section>

        {PRELUDE_MATCH_MENTORS.map((mentor, index) => (
          <motion.div
            key={mentor.id}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + index * 0.06, duration: 0.3 }}
          >
            <PreludeMentorCard mentor={mentor} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
