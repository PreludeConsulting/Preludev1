export const AURA_LERP = 0.18;
export const AURA_SIZE_PX = 68;

/**
 * Linear interpolation for smooth cursor follow.
 * @param {number} from
 * @param {number} to
 * @param {number} alpha
 */
export function lerp(from, to, alpha) {
  return from + (to - from) * alpha;
}

/**
 * @param {number} currentX
 * @param {number} currentY
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} [alpha]
 */
export function lerpPoint(currentX, currentY, targetX, targetY, alpha = AURA_LERP) {
  return {
    x: lerp(currentX, targetX, alpha),
    y: lerp(currentY, targetY, alpha)
  };
}

/**
 * @param {PointerEvent | MouseEvent} event
 */
export function pointerCoords(event) {
  return { x: event.clientX, y: event.clientY };
}

/**
 * @param {number | undefined} alpha
 * @param {boolean} reducedMotion
 */
export function followAlpha(alpha, reducedMotion) {
  if (reducedMotion) return 1;
  return alpha ?? AURA_LERP;
}
