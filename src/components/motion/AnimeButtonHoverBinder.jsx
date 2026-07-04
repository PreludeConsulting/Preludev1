import { useEffect } from "react";
import { bindButtonHoverGlowAll } from "../../lib/buttonHoverMotion.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

/**
 * Binds glow/sheen hover motion to primary CTA buttons on the landing page.
 */
export default function AnimeButtonHoverBinder() {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return undefined;
    const cleanup = bindButtonHoverGlowAll(document, { reducedMotion });
    return cleanup;
  }, [reducedMotion]);

  return null;
}
