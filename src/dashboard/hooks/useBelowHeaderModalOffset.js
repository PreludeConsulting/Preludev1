import { useEffect } from "react";

const HEADER_SELECTOR = ".dash-product-nav, .dash-topbar";
const CSS_VAR = "--dash-header-bottom";

/**
 * Measures the dashboard header/divider bottom edge and exposes it as
 * `--dash-header-bottom` for below-header modal positioning.
 */
export function useBelowHeaderModalOffset(active) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;

    const root = document.documentElement;
    let frame = 0;
    let observer = null;

    function measure() {
      const header = document.querySelector(HEADER_SELECTOR);
      const bottom = header ? Math.max(0, Math.ceil(header.getBoundingClientRect().bottom)) : 0;
      root.style.setProperty(CSS_VAR, `${bottom}px`);
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    const header = document.querySelector(HEADER_SELECTOR);
    if (header && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(header);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer?.disconnect();
      root.style.removeProperty(CSS_VAR);
    };
  }, [active]);
}
