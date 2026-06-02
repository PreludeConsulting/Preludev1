import { motion } from "motion/react";
import { cn } from "../../lib/utils.js";

export default function AnswerChip({ label, selected, onSelect, reducedMotion }) {
  return (
    <motion.button
      type="button"
      className={cn("pm-chip", selected && "pm-chip--selected")}
      onClick={() => onSelect(label)}
      whileHover={reducedMotion ? undefined : { y: -1 }}
      whileTap={reducedMotion ? undefined : { scale: 0.99 }}
      aria-pressed={selected}
    >
      {selected ? <span className="pm-chip__check" aria-hidden="true">✓</span> : null}
      {label}
    </motion.button>
  );
}
