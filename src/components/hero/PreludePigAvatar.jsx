/**
 * Official Prelude pig mascot — public/images/prelude-pig-mascot.png
 */
import { motion } from "motion/react";
import { cn } from "../../lib/utils.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

export const PIG_MASCOT_SRC = `${import.meta.env.BASE_URL}images/prelude-pig-mascot.png`;

const SIZE_CLASS = {
  sm: "prelude-pig-avatar__frame--sm",
  md: "prelude-pig-avatar__frame--md",
  lg: "prelude-pig-avatar__frame--lg"
};

const VARIANT_SIZE = {
  intro: "md",
  question: "sm",
  loading: "lg",
  results: "sm"
};

export default function PreludePigAvatar({
  size,
  variant = "intro",
  className = "",
  animate = false,
  motion: motionState = "none",
  label = "Prelude mascot"
}) {
  const reducedMotion = useReducedMotion();
  const resolvedSize = size ?? VARIANT_SIZE[variant] ?? "md";
  const frameClass = SIZE_CLASS[resolvedSize] ?? SIZE_CLASS.md;

  const motionProps = (() => {
    if (reducedMotion) return {};
    if (motionState === "bounce" || motionState === "celebrate") {
      return {
        animate: { y: [0, -5, 0] },
        transition: { duration: 0.4, ease: "easeOut" }
      };
    }
    if (animate) {
      return {
        animate: { y: [0, -3, 0] },
        transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
      };
    }
    return {};
  })();

  const showRing = variant === "loading" || motionState === "pulse";

  return (
    <motion.div className={cn("prelude-pig-avatar", className)} {...motionProps} aria-hidden={!label}>
      {showRing && !reducedMotion ? <span className="prelude-pig-avatar__ring" aria-hidden="true" /> : null}
      <span className={cn("prelude-pig-avatar__frame", frameClass)}>
        <img
          src={PIG_MASCOT_SRC}
          alt={label || "Prelude mascot"}
          className="prelude-pig-avatar__img"
          width={128}
          height={128}
          decoding="async"
          loading="eager"
          draggable={false}
        />
      </span>
    </motion.div>
  );
}
