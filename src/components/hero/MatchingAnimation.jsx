import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { HERO_MATCHING_STATUSES, HERO_MENTOR_MOCK } from "../../data/heroMentorMatch.js";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

export default function MatchingAnimation({ onComplete, reducedMotion }) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = reducedMotion ? 600 : 520;
    const timer = setInterval(() => {
      setStatusIndex((i) => (i + 1) % HERO_MATCHING_STATUSES.length);
    }, interval);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const done = setTimeout(() => onComplete?.(), reducedMotion ? 1800 : 3200);
    return () => clearTimeout(done);
  }, [onComplete, reducedMotion]);

  return (
    <div className="hero-mm-matching" aria-live="polite" aria-busy="true">
      <div className="hero-mm-matching__orbit" aria-hidden="true" />
      <div className="hero-mm-matching__center">
        <PreludePigAvatar size="xl" animate="processing" reducedMotion={reducedMotion} />
        <h2 className="hero-mm-matching__title">Building your mentor match…</h2>
        <motion.p
          key={statusIndex}
          className="hero-mm-matching__status"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {HERO_MATCHING_STATUSES[statusIndex]}
        </motion.p>
      </div>

      <div className="hero-mm-matching__cards" aria-hidden="true">
        {HERO_MENTOR_MOCK.map((mentor, index) => (
          <motion.div
            key={mentor.id}
            className="hero-mm-matching__mini"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: Math.cos((index / 3) * Math.PI * 2) * 72,
              y: Math.sin((index / 3) * Math.PI * 2) * 48
            }}
            transition={{ delay: index * 0.12, duration: 0.4 }}
          >
            <span>{mentor.initials}</span>
          </motion.div>
        ))}
      </div>

      <div className="hero-mm-matching__sparkles" aria-hidden="true" />
    </div>
  );
}
