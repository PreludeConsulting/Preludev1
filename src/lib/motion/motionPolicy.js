export const MOTION_TIERS = Object.freeze({
  full: "full",
  lite: "lite",
  reduced: "reduced"
});

const CONSTRAINED_CPU_MAX = 4;
const CONSTRAINED_MEMORY_GB_MAX = 4;

export function detectMotionTier({
  reducedMotion = false,
  hardwareConcurrency,
  deviceMemory,
  coarsePointer = false
} = {}) {
  if (reducedMotion) return MOTION_TIERS.reduced;

  const constrainedCpu =
    Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 && hardwareConcurrency <= CONSTRAINED_CPU_MAX;
  const constrainedMemory =
    Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= CONSTRAINED_MEMORY_GB_MAX;

  if (constrainedCpu || constrainedMemory || coarsePointer) return MOTION_TIERS.lite;
  return MOTION_TIERS.full;
}

export function isMotionActive({ documentVisible, inViewport, reducedMotion = false } = {}) {
  return Boolean(documentVisible && inViewport && !reducedMotion);
}

