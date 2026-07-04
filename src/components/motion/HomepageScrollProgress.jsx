import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import {
  ACTIVE_LABEL_IDLE_MS,
  HOMEPAGE_SCROLL_SECTIONS,
  attachHomepageSectionTracker,
  getDocumentScrollProgress,
  lerpScrollProgress,
  resolveActiveSectionAtProgress,
  resolveSectionIndexAtRatio,
  resolveSectionIndexNearRatio,
  scrollToHomepageSection
} from "../../lib/homepageScrollSections.js";

const RESIZE_DEBOUNCE_MS = 150;
const MOBILE_MAX_WIDTH_PX = 768;

/**
 * Custom scroll navigation rail — section ticks, progress fill, click-to-snap.
 * Fill position and active tick share one scroll-progress value per frame.
 * Hidden below 768px to avoid mobile scroll-gesture and safe-area conflicts.
 */
export default function HomepageScrollProgress() {
  const reducedMotion = useReducedMotion();
  const trackRef = useRef(null);
  const fillRef = useRef(null);
  const thumbRef = useRef(null);
  const activeLabelRef = useRef(null);
  const tickRefs = useRef([]);
  const idleTimerRef = useRef(0);
  const activeIndexRef = useRef(0);
  const trackerRef = useRef(null);

  const [sections, setSections] = useState([]);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [mobileHidden, setMobileHidden] = useState(false);

  const hideActiveLabel = useCallback(() => {
    activeLabelRef.current?.classList.remove("is-visible");
  }, []);

  const showActiveLabel = useCallback(() => {
    const label = activeLabelRef.current;
    if (!label) return;

    label.classList.add("is-visible");
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      hideActiveLabel();
    }, ACTIVE_LABEL_IDLE_MS);
  }, [hideActiveLabel]);

  const paintActiveSection = useCallback(
    (activeIndex, nextSections) => {
      activeIndexRef.current = activeIndex;
      const section = nextSections[activeIndex];
      if (!section) return;

      tickRefs.current.forEach((tick, index) => {
        if (!tick) return;
        tick.classList.toggle("homepage-scroll-nav__tick--active", index === activeIndex);
        if (index === activeIndex) tick.setAttribute("aria-current", "true");
        else tick.removeAttribute("aria-current");
      });

      const label = activeLabelRef.current;
      if (!label) return;

      const nextTop = `${section.ratio * 100}%`;
      const labelChanged = label.textContent !== section.label;
      const positionChanged = label.style.top !== nextTop;

      if (labelChanged && !reducedMotion && label.classList.contains("is-visible")) {
        label.classList.add("is-changing");
        window.requestAnimationFrame(() => {
          label.textContent = section.label;
          label.style.top = nextTop;
          label.classList.remove("is-changing");
        });
      } else {
        if (labelChanged) label.textContent = section.label;
        if (positionChanged) label.style.top = nextTop;
      }

      showActiveLabel();
    },
    [reducedMotion, showActiveLabel]
  );

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

    document.documentElement.classList.add("homepage-scroll-nav-active");

    const tracker = attachHomepageSectionTracker({
      onActiveChange: ({ sections: measured }) => {
        setSections(measured);
      }
    });
    trackerRef.current = tracker;
    const initialSections = tracker.getSections();
    setSections(initialSections);

    let resizeTimer = 0;
    let scrollFrame = 0;
    let fillFrame = 0;
    let displayProgress = getDocumentScrollProgress();

    const syncRailFromProgress = (progress, measured) => {
      applyFillProgress(progress);
      const activeIndex = resolveActiveSectionAtProgress(progress, measured);
      if (activeIndex !== activeIndexRef.current) {
        paintActiveSection(activeIndex, measured);
      }
    };

    const applyFillProgress = (progress) => {
      const pct = `${progress * 100}%`;
      if (fillRef.current) fillRef.current.style.height = pct;
      if (thumbRef.current) thumbRef.current.style.top = pct;
    };

    const animateFill = () => {
      const target = getDocumentScrollProgress();
      const alpha = reducedMotion ? 1 : 0.22;
      displayProgress = lerpScrollProgress(displayProgress, target, alpha);
      syncRailFromProgress(displayProgress, tracker.getSections());

      if (displayProgress !== target) {
        fillFrame = requestAnimationFrame(animateFill);
      }
    };

    const paintScroll = () => {
      cancelAnimationFrame(fillFrame);
      fillFrame = requestAnimationFrame(animateFill);
    };

    const onScroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        paintScroll();
        showActiveLabel();
      });
    };

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const measured = tracker.remeasure() ?? tracker.getSections();
        setSections(measured);
        syncRailFromProgress(displayProgress, measured);
      }, RESIZE_DEBOUNCE_MS);
    };

    syncRailFromProgress(displayProgress, initialSections);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      document.documentElement.classList.remove("homepage-scroll-nav-active");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(idleTimerRef.current);
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(fillFrame);
      tracker.disconnect();
      trackerRef.current = null;
    };
  }, [mobileHidden, paintActiveSection, reducedMotion, showActiveLabel]);

  const navigateToSection = useCallback(
    (sectionId) => {
      scrollToHomepageSection(sectionId, { reducedMotion });
    },
    [reducedMotion]
  );

  const handleTrackClick = useCallback(
    (event) => {
      if (event.target.closest(".homepage-scroll-nav__tick")) return;

      const track = trackRef.current;
      if (!track || sections.length === 0) return;

      const rect = track.getBoundingClientRect();
      if (rect.height <= 0) return;

      const ratio = (event.clientY - rect.top) / rect.height;
      const nearIndex = resolveSectionIndexNearRatio(ratio, sections);
      const index = nearIndex >= 0 ? nearIndex : resolveSectionIndexAtRatio(ratio, sections);
      const target = sections[index];
      if (target) navigateToSection(target.id);
    },
    [navigateToSection, sections]
  );

  if (mobileHidden) return null;

  const tooltipIndex = focusedIndex >= 0 ? focusedIndex : hoveredIndex;
  const tooltipSection = tooltipIndex >= 0 ? sections[tooltipIndex] : null;

  return (
    <nav className="homepage-scroll-nav" aria-label="Page sections">
      <div className="homepage-scroll-nav__rail">
        <div
          ref={trackRef}
          className="homepage-scroll-nav__track"
          onClick={handleTrackClick}
          role="presentation"
        >
          <div className="homepage-scroll-nav__ticks" aria-hidden="true" />
          <div ref={fillRef} className="homepage-scroll-nav__fill" aria-hidden="true" />
          {sections.map((section) => (
            <button
              key={section.id}
              ref={(node) => {
                tickRefs.current[section.index] = node;
              }}
              type="button"
              className="homepage-scroll-nav__tick"
              style={{ top: `${section.ratio * 100}%` }}
              aria-label={`Jump to ${section.label} section`}
              onClick={(event) => {
                event.stopPropagation();
                navigateToSection(section.id);
              }}
              onMouseEnter={() => setHoveredIndex(section.index)}
              onMouseLeave={() => setHoveredIndex(-1)}
              onFocus={() => setFocusedIndex(section.index)}
              onBlur={() => setFocusedIndex(-1)}
            />
          ))}
          <div ref={thumbRef} className="homepage-scroll-nav__thumb" aria-hidden="true" />
        </div>

        <div
          ref={activeLabelRef}
          className={`homepage-scroll-nav__active-label${reducedMotion ? " homepage-scroll-nav__active-label--reduced" : ""}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {sections[activeIndexRef.current]?.label ?? HOMEPAGE_SCROLL_SECTIONS[0].label}
        </div>

        {tooltipSection ? (
          <div
            className="homepage-scroll-nav__tooltip"
            style={{ top: `${tooltipSection.ratio * 100}%` }}
            aria-hidden="true"
          >
            {tooltipSection.label}
          </div>
        ) : null}
      </div>

      <span className="sr-only">
        {HOMEPAGE_SCROLL_SECTIONS.map((section) => section.label).join(", ")}
      </span>
    </nav>
  );
}
