import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { HERO_MATCHING_STATUSES } from "../../data/preludeMatchMentors.js";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

export default function PreludeMatchLoading({ onComplete, reducedMotion, progressFrom = 90 }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const initialProgress = reducedMotion ? 100 : Math.max(0, Math.min(100, progressFrom));
  const [displayProgress, setDisplayProgress] = useState(initialProgress);
  const progressFillRef = useRef(null);
  const progressFrameRef = useRef(0);
  const lastDisplayProgressRef = useRef(initialProgress);
  const duration = reducedMotion ? 2200 : 3400;

  const renderProgress = useCallback((value) => {
    const clamped = Math.max(0, Math.min(100, value));
    if (progressFillRef.current) {
      progressFillRef.current.style.transform = `scaleX(${clamped / 100})`;
      if (clamped >= 100) progressFillRef.current.style.willChange = "auto";
    }

    const rounded = Math.round(clamped);
    if (rounded !== lastDisplayProgressRef.current) {
      lastDisplayProgressRef.current = rounded;
      setDisplayProgress(rounded);
    }
  }, []);

  useEffect(() => {
    if (reducedMotion || HERO_MATCHING_STATUSES.length <= 1) return undefined;
    const step = reducedMotion ? 900 : 560;
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % HERO_MATCHING_STATUSES.length);
    }, step);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  useEffect(() => {
    progressFrameRef.current = 0;
    if (reducedMotion) {
      renderProgress(100);
      return undefined;
    }
    const start = performance.now();
    const from = Math.max(0, Math.min(100, progressFrom));
    renderProgress(from);
    if (from >= 100) return undefined;

    const tick = (now) => {
      progressFrameRef.current = 0;
      const t = Math.min(1, (now - start) / duration);
      renderProgress(from + (100 - from) * t);
      if (t < 1) progressFrameRef.current = requestAnimationFrame(tick);
    };
    progressFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (progressFrameRef.current) cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = 0;
    };
  }, [progressFrom, duration, reducedMotion, renderProgress]);

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
        <div
          ref={progressFillRef}
          className="pm-progress__fill"
          style={{
            width: "100%",
            transform: `scaleX(${initialProgress / 100})`,
            transformOrigin: "left center",
            willChange: reducedMotion ? "auto" : "transform"
          }}
        />
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
