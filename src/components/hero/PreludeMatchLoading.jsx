import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { HERO_MATCHING_STATUSES } from "../../data/preludeMatchMentors.js";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

export default function PreludeMatchLoading({ onComplete, reducedMotion, progressFrom = 90 }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(progressFrom);
  const duration = reducedMotion ? 2200 : 3400;

  useEffect(() => {
    const step = reducedMotion ? 900 : 560;
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % HERO_MATCHING_STATUSES.length);
    }, step);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayProgress(100);
      return;
    }
    const start = performance.now();
    const from = progressFrom;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplayProgress(Math.round(from + (100 - from) * t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [progressFrom, duration, reducedMotion]);

  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  return (
    <div className="pm-loading" aria-live="polite" aria-busy="true">
      <div className="pm-loading__visual">
        {!reducedMotion ? (
          <>
            <span className="pm-loading__ring pm-loading__ring--outer" aria-hidden="true" />
            <span className="pm-loading__ring pm-loading__ring--inner" aria-hidden="true" />
            <span className="pm-loading__scan" aria-hidden="true" />
          </>
        ) : null}
        <PreludePigAvatar variant="loading" motion="pulse" label="" />
      </div>

      <h2 className="pm-loading__title">Finding your strongest mentor matches</h2>
      <p className="pm-loading__sub">
        PreludeMatch is comparing your goals with mentor experience and availability.
      </p>

      <div
        className="pm-progress pm-loading__progress"
        role="progressbar"
        aria-valuenow={displayProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div className="pm-progress__fill" animate={{ width: `${displayProgress}%` }} />
      </div>

      <motion.p
        key={statusIndex}
        className="pm-loading__status"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {HERO_MATCHING_STATUSES[statusIndex]}
      </motion.p>
    </div>
  );
}
