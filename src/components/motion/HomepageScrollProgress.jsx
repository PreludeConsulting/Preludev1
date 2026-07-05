import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import { getDocumentScrollProgress, lerpScrollProgress } from "../../lib/homepageScrollSections.js";

const MOBILE_MAX_WIDTH_PX = 768;
const FILL_LERP_ALPHA = 0.2;

/**
 * Fixed homepage scroll progress bar — decorative position marker only.
 * Native scrollbar is hidden on desktop homepage; scrolling stays fully functional.
 */
export default function HomepageScrollProgress() {
  const reducedMotion = useReducedMotion();
  const fillRef = useRef(null);
  const [mobileHidden, setMobileHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
    const syncMobile = () => setMobileHidden(mq.matches);
    syncMobile();
    mq.addEventListener("change", syncMobile);
    return () => mq.removeEventListener("change", syncMobile);
  }, []);

  useEffect(() => {
    if (mobileHidden) return undefined;

    document.documentElement.classList.add("homepage-scroll-bar-active");

    let displayProgress = getDocumentScrollProgress();
    let fillFrame = 0;
    let scrollFrame = 0;

    const applyFill = (progress) => {
      if (fillRef.current) {
        fillRef.current.style.height = `${progress * 100}%`;
      }
    };

    const animateFill = () => {
      const target = getDocumentScrollProgress();
      const alpha = reducedMotion ? 1 : FILL_LERP_ALPHA;
      displayProgress = lerpScrollProgress(displayProgress, target, alpha);
      applyFill(displayProgress);

      if (displayProgress !== target) {
        fillFrame = requestAnimationFrame(animateFill);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(animateFill);
    };

    const onResize = () => {
      displayProgress = getDocumentScrollProgress();
      applyFill(displayProgress);
    };

    applyFill(displayProgress);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      document.documentElement.classList.remove("homepage-scroll-bar-active");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(fillFrame);
    };
  }, [mobileHidden, reducedMotion]);

  if (mobileHidden) return null;

  return (
    <div className="homepage-scroll-bar" aria-hidden="true">
      <div className="homepage-scroll-bar__track">
        <div ref={fillRef} className="homepage-scroll-bar__fill" />
      </div>
    </div>
  );
}
