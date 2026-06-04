import { motion, AnimatePresence } from "motion/react";
import PreludeLogo from "../PreludeLogo.jsx";
import { useHeroIntroContext } from "../../context/HeroIntroContext.jsx";

const NODES = [
  { x: -72, y: -48 },
  { x: 78, y: -36 },
  { x: -64, y: 52 },
  { x: 70, y: 58 },
  { x: 0, y: -78 }
];

export default function HeroOpeningOverlay() {
  const { showOverlay, phase, reducedMotion } = useHeroIntroContext();

  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      {showOverlay ? (
        <motion.div
          className="hero-opening"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          aria-hidden="true"
        >
          <div className="hero-opening__bg" />
          <div className="hero-opening__scanlines" />

          <div className="hero-opening__center">
            <motion.div
              className="hero-opening__glow"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />

            <motion.div
              className="hero-opening__logo-wrap"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className="hero-opening__logo-mask">
                <motion.div
                  className="hero-opening__logo-reveal"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PreludeLogo className="hero-opening__logo" />
                </motion.div>
              </div>
            </motion.div>

            {phase === "network" || phase === "transition" ? (
              <svg className="hero-opening__network" viewBox="-100 -90 200 180" aria-hidden="true">
                {NODES.map((node, i) => (
                  <g key={i}>
                    <motion.line
                      x1="0"
                      y1="0"
                      x2={node.x}
                      y2={node.y}
                      stroke="hsl(var(--primary) / 0.35)"
                      strokeWidth="1"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: i * 0.08, duration: 0.45 }}
                    />
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r="4"
                      fill="hsl(var(--primary))"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.85] }}
                      transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                    />
                  </g>
                ))}
              </svg>
            ) : null}

            {phase === "network" ? (
              <motion.div
                className="hero-opening__pulse"
                initial={{ opacity: 0.5, scale: 0.6 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
            ) : null}

            <motion.p
              className="hero-opening__status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
            >
              Initializing PreludeMatch
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
