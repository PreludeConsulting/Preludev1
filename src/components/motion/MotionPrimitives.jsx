import { motion } from "motion/react";
import { usePreludeMotion } from "../../context/MotionContext.jsx";

export function MotionPage({ children, className = "" }) {
  const { reducedMotion } = usePreludeMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {children}
    </motion.div>
  );
}

export function MotionPanel({ children, className = "", ...props }) {
  const { reducedMotion } = usePreludeMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: -4, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionDialog({ children, className = "", ...props }) {
  const { reducedMotion } = usePreludeMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
