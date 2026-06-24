import { motion } from "motion/react";
import { usePreludeMotion } from "../../context/MotionContext.jsx";
import { MOTION } from "../../lib/motion/tokens.js";
import { useInterfaceSound } from "../../lib/sound/SoundProvider.jsx";
import { cn } from "../../lib/utils.js";

export default function InteractiveButton({
  as: Tag = "button",
  className,
  children,
  loading = false,
  sound = true,
  onClick,
  ...props
}) {
  const { reducedMotion } = usePreludeMotion();
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const isDisabled = Boolean(props.disabled || loading || props["aria-disabled"]);

  const MotionTag = motion.create(Tag);

  function handleClick(e) {
    if (isDisabled) return;
    if (sound) play(SOUND_EVENTS.CLICK);
    onClick?.(e);
  }

  return (
    <MotionTag
      className={cn(className, loading && "prelude-btn-motion--loading")}
      whileHover={!isDisabled && !reducedMotion ? MOTION.hover : undefined}
      whileTap={!isDisabled && !reducedMotion ? MOTION.press : undefined}
      transition={MOTION.spring}
      onClick={handleClick}
      disabled={Tag === "button" ? isDisabled : undefined}
      aria-disabled={Tag !== "button" && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="prelude-btn-motion__spinner" aria-hidden="true" /> : null}
      {children}
    </MotionTag>
  );
}
