/** Shared motion tokens for Prelude interactions. */
export const MOTION = {
  press: {
    standard: 0.98,
    primary: 0.97,
    destructive: 0.975,
    selection: 0.985
  },
  pressMs: 100,
  releaseMs: 180,
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
