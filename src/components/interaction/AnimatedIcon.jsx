import { motion } from "motion/react";
import { usePreludeMotion } from "../../context/MotionContext.jsx";
import { MOTION } from "../../lib/motion/tokens.js";

const VARIANTS = {
  heart: { animate: { scale: [1, 1.2, 1], rotate: [0, -8, 0] } },
  heartUnsave: { animate: { scale: [1, 0.88, 1], opacity: [1, 0.85, 1] } },
  star: { animate: { scale: [1, 1.18, 1], rotate: [0, 18, 0] } },
  bookmark: { animate: { scale: [0.88, 1.08, 1], y: [2, -1, 0] } },
  send: { animate: { x: [0, 5, 0], scale: [1, 0.94, 1] } },
  plus: { animate: { rotate: [0, 90, 0], scale: [1, 1.1, 1] } },
  check: { animate: { scale: [0.7, 1.15, 1], opacity: [0.6, 1, 1] } },
  bell: { animate: { rotate: [0, 12, -10, 8, 0] } },
  calendar: { animate: { scale: [1, 1.12, 1], rotate: [0, -4, 0] } },
  trophy: { animate: { y: [0, -4, 0], scale: [1, 1.1, 1] } },
  coin: { animate: { rotate: [0, 180, 360], scale: [1, 1.08, 1] } },
  settings: { animate: { rotate: [0, 45, 0] } },
  message: { animate: { scale: [1, 1.14, 1] } },
  edit: { animate: { rotate: [0, -12, 0], y: [0, -1, 0] } },
  trash: { animate: { scale: [1, 0.86, 1], opacity: [1, 0.75, 1] } },
  default: { animate: { scale: [1, 1.08, 1] } }
};

export default function AnimatedIcon({
  variant = "default",
  active = false,
  className = "",
  children,
  as: Tag = "span"
}) {
  const { reducedMotion } = usePreludeMotion();
  const spec = VARIANTS[variant] || VARIANTS.default;
  const MotionTag = motion.create(Tag);

  if (reducedMotion || !active) {
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      animate={spec.animate}
      transition={MOTION.iconPop}
      style={{ display: "inline-flex", transformOrigin: "center" }}
    >
      {children}
    </MotionTag>
  );
}
