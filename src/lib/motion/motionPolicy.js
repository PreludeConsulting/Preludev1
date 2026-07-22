/** @typedef {"full" | "lite" | "reduced"} MotionTier */

/** @type {Readonly<Record<MotionTier, MotionTier>>} */
export const MOTION_TIERS = Object.freeze({
  full: "full",
  lite: "lite",
  reduced: "reduced"
});

/**
 * Choose a platform-neutral motion tier.
 *
 * Browser hardware hints are intentionally excluded here. `deviceMemory` is
 * exposed by Chromium but not Safari, while CPU and pointer reporting also
 * varies by browser and operating system. Using those hints made the same site
 * render full motion on macOS and lite/static motion on Windows.
 *
 * @param {{ reducedMotion?: boolean }} [preferences]
 * @returns {MotionTier}
 */
export function detectMotionTier({
  reducedMotion = false
} = {}) {
  if (reducedMotion) return MOTION_TIERS.reduced;
  return MOTION_TIERS.full;
}

/** @param {{ documentVisible?: boolean, inViewport?: boolean, reducedMotion?: boolean }} [state] */
export function isMotionActive({ documentVisible, inViewport, reducedMotion = false } = {}) {
  return Boolean(documentVisible && inViewport && !reducedMotion);
}

/** @param {{ reducedMotion?: boolean, motionTier?: MotionTier }} [policy] */
export function shouldUseStaticLandingMotion({
  reducedMotion = false,
  motionTier = MOTION_TIERS.full
} = {}) {
  return Boolean(
    reducedMotion ||
    motionTier === MOTION_TIERS.lite ||
    motionTier === MOTION_TIERS.reduced
  );
}
