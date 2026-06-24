/** Shared motion tokens for Prelude interactions. */
export const MOTION = {
  press: { scale: 0.96, y: 1 },
  hover: { y: -2, scale: 1.01 },
  spring: { type: "spring", stiffness: 520, damping: 28, mass: 0.55 },
  easeOut: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  iconPop: { duration: 0.32, ease: [0.34, 1.4, 0.64, 1] },
  messageIn: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  coinBurstMs: 1200
};

export function motionEnabled(reducedMotion) {
  return !reducedMotion;
}
