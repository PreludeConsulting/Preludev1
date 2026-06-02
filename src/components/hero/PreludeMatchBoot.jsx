import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import PreludeLogo from "../PreludeLogo.jsx";

const NODES = [
  { x: -52, y: -38 },
  { x: 56, y: -32 },
  { x: -48, y: 42 },
  { x: 50, y: 44 }
];

export default function PreludeMatchBoot({ reducedMotion, onComplete }) {
  const [phase, setPhase] = useState(reducedMotion ? "done" : "logo");
  const completedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      onComplete?.();
      return;
    }
    const t1 = setTimeout(() => setPhase("network"), 650);
    const t2 = setTimeout(() => {
      setPhase("done");
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }, 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reducedMotion, onComplete]);

  if (reducedMotion || phase === "done") return null;

  return (
    <div className="pm-boot" aria-live="polite" aria-busy="true">
      <div className="pm-boot__glow" aria-hidden="true" />

      <AnimatePresence mode="wait">
        <motion.div
          key="logo"
          className="pm-boot__center"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "network" ? 1 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="pm-boot__logo-mask">
            <motion.div
              className="pm-boot__logo-reveal"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <PreludeLogo className="pm-boot__logo" />
            </motion.div>
          </div>

          {phase === "network" ? (
            <>
              <svg className="pm-boot__network" viewBox="-70 -60 140 120" aria-hidden="true">
                {NODES.map((node, i) => (
                  <g key={i}>
                    <motion.line
                      x1="0"
                      y1="0"
                      x2={node.x}
                      y2={node.y}
                      stroke="hsl(var(--primary) / 0.35)"
                      strokeWidth="1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.07, duration: 0.35 }}
                    />
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r="3.5"
                      fill="hsl(var(--primary))"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.15, 1], opacity: [0, 0.9, 0.65] }}
                      transition={{ delay: 0.15 + i * 0.07, duration: 0.45 }}
                    />
                  </g>
                ))}
              </svg>
              <motion.span
                className="pm-boot__scan"
                aria-hidden="true"
                initial={{ opacity: 0.4, scale: 0.7 }}
                animate={{ opacity: 0, scale: 1.5 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </>
          ) : null}

          <p className="pm-boot__status">Initializing PreludeMatch</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
