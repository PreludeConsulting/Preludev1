import { useEffect, useRef } from "react";
import { bindButtonHoverGlow } from "../lib/buttonHoverMotion.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

/**
 * Attach anime.js glow/sheen hover to a single button element.
 * @param {boolean} [enabled=true]
 */
export function useAnimeButtonHover(enabled = true) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled || reducedMotion || !ref.current) return undefined;
    return bindButtonHoverGlow(ref.current, { reducedMotion });
  }, [enabled, reducedMotion]);

  return ref;
}
