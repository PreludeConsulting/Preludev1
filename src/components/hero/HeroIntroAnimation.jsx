import { motion } from "motion/react";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

const line = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 + i * 0.06, duration: 0.45, ease: "easeOut" }
  })
};

export function HeroHeadline() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    return (
      <h1 className="shopify-hero__headline">
        <span className="shopify-hero__headline-line">College admissions</span>
        <span className="shopify-hero__headline-line">counseling,</span>
        <span className="shopify-hero__headline-accent hero-headline-shimmer shopify-hero__headline-line">
          reimagined.
        </span>
      </h1>
    );
  }

  return (
    <motion.h1 className="shopify-hero__headline" initial="hidden" animate="show">
      <motion.span className="shopify-hero__headline-line block" custom={0} variants={line}>
        College admissions
      </motion.span>
      <motion.span className="shopify-hero__headline-line block" custom={1} variants={line}>
        counseling,
      </motion.span>
      <motion.span
        className="shopify-hero__headline-accent hero-headline-shimmer shopify-hero__headline-line block"
        custom={2}
        variants={line}
      >
        reimagined.
      </motion.span>
    </motion.h1>
  );
}

export function HeroVisualAnimation({ children }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="shopify-hero__visual"
      initial={reducedMotion ? false : { opacity: 0, x: 16, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: 0.12, duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function HeroSubcopy({ children }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <p className="shopify-hero__subcopy">{children}</p>;

  return (
    <motion.p
      className="shopify-hero__subcopy"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.4 }}
    >
      {children}
    </motion.p>
  );
}

export function HeroFormAnimation({ children }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return children;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}
