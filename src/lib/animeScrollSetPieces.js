import {
  applyStyles,
  combineReverts,
  createElasticStaggerReveal,
  createMountTimeline,
  createMultiPropertyEnter,
  createPopReveal,
  enterHiddenState,
  isElementInViewport,
  snapEnterFinalState,
  TIER2_DEFAULTS
} from "./animeScrollMotion.js";

/**
 * Tier 2 set-piece presets for homepage hero-level sections.
 *
 * Final tier map (homepage):
 * - Tier 2: Hero, NetworkSection, StudentNetworkSection
 * - Tier 1: UniversityCarousel, AdmissionsCostBanner, LowerBenefits, LowerPlans,
 *           LowerAcademicPrograms, LowerCta
 * - None: LowerFooter, Navbar (Motion scroll shrink only)
 *
 * Ambiguous sections kept calm intentionally:
 * - AdmissionsCostBanner (trust-adjacent cost messaging)
 * - LowerBenefits (product visual but secondary to set pieces)
 */

/** @typedef {{
 *   headlineLines?: HTMLElement[],
 *   subcopy?: HTMLElement | null,
 *   formWrap?: HTMLElement | null,
 *   note?: HTMLElement | null,
 *   visual?: HTMLElement | null,
 *   section?: HTMLElement | null
 * }} HeroSetPieceRefs
 */

/** Above-fold hero mount sequence (not scroll-triggered). */
export function mountHeroSetPiece(refs, { reducedMotion = false } = {}) {
  const {
    headlineLines = [],
    subcopy,
    formWrap,
    note,
    visual,
    section
  } = refs || {};

  const allEls = [...headlineLines, subcopy, formWrap, note, visual].filter(Boolean);

  if (reducedMotion) {
    snapEnterFinalState(null, allEls);
    return { revert() {} };
  }

  if (allEls.length === 0) {
    return { revert() {} };
  }

  headlineLines.filter(Boolean).forEach((line) => applyStyles(line, enterHiddenState(18)));
  [subcopy, formWrap, note].filter(Boolean).forEach((el) => applyStyles(el, enterHiddenState(14)));
  if (visual) {
    applyStyles(visual, { opacity: "0", transform: "translateX(24px) scale(0.96)" });
  }

  const mountTl = createMountTimeline(
    (tl) => {
      headlineLines.filter(Boolean).forEach((line, index) => {
        tl.add(
          line,
          {
            opacity: [0, 1],
            translateY: [18, 0],
            duration: 520
          },
          index * 60
        );
      });

      const baseOffset = headlineLines.length * 60 + 40;

      if (subcopy) {
        tl.add(subcopy, { opacity: [0, 1], translateY: [14, 0], duration: 480 }, baseOffset);
      }
      if (formWrap) {
        tl.add(formWrap, { opacity: [0, 1], translateY: [14, 0], duration: 480 }, baseOffset + 80);
      }
      if (note) {
        tl.add(note, { opacity: [0, 1], translateY: [10, 0], duration: 420 }, baseOffset + 140);
      }
      if (visual) {
        tl.add(
          visual,
          {
            opacity: [0, 1],
            translateX: [24, 0],
            scale: [0.96, 1],
            duration: 680,
            ease: TIER2_DEFAULTS.springEase
          },
          120
        );
      }
    },
    { reducedMotion, children: allEls }
  );

  const safetyId = setTimeout(() => {
    allEls.forEach((el) => {
      if (el?.style?.opacity === "0") snapEnterFinalState(el);
    });
  }, 2000);

  return {
    revert() {
      clearTimeout(safetyId);
      mountTl.revert?.();
    }
  };
}

/**
 * @typedef {{
 *   section?: HTMLElement | null,
 *   badge?: HTMLElement | null,
 *   headlineLines?: HTMLElement[],
 *   subtitle?: HTMLElement | null
 * }} NetworkSetPieceRefs
 */

export function mountNetworkSectionSetPiece(refs, { reducedMotion = false, debug = false } = {}) {
  const {
    section,
    badge,
    headlineLines = [],
    subtitle
  } = refs || {};

  if (!section) return { revert() {} };

  const children = [badge, subtitle, ...headlineLines].filter(Boolean);

  if (reducedMotion) {
    snapEnterFinalState(section, children);
    return { revert() {} };
  }

  const handles = [];

  if (badge) {
    handles.push(createPopReveal(badge, { reducedMotion, scrollTarget: section, debug, delay: 0 }));
  }

  const combined = combineReverts(...handles);
  const safetyId = setTimeout(() => {
    if (badge && getComputedStyle(badge).opacity === "0" && isElementInViewport(badge)) {
      snapEnterFinalState(badge);
    }
  }, 3200);

  return {
    revert() {
      clearTimeout(safetyId);
      combined.revert();
    }
  };
}

/**
 * @typedef {{
 *   section?: HTMLElement | null,
 *   headline?: HTMLElement | null,
 *   panelEls?: HTMLElement[]
 * }} StudentNetworkSetPieceRefs
 */

export function mountStudentNetworkSetPiece(refs, { reducedMotion = false, debug = false } = {}) {
  const { section, headline, panelEls = [] } = refs || {};

  if (!section) return { revert() {} };

  const children = [headline, ...panelEls].filter(Boolean);

  if (reducedMotion) {
    snapEnterFinalState(section, children);
    return { revert() {} };
  }

  const handles = [];

  if (headline) {
    handles.push(
      createMultiPropertyEnter(headline, {
        reducedMotion,
        scrollTarget: section,
        debug,
        from: { opacity: 0, translateY: 36, scale: 0.94, rotate: -1 },
        to: { opacity: 1, translateY: 0, scale: 1, rotate: 0 },
        ease: TIER2_DEFAULTS.springEase
      })
    );
  }

  if (panelEls.length > 0) {
    handles.push(
      createElasticStaggerReveal(section, panelEls, {
        reducedMotion,
        debug,
        staggerDelays: [140, 280],
        fromScale: 0.86,
        distancePx: 44
      })
    );
  }

  const combined = combineReverts(...handles);
  const safetyId = setTimeout(() => {
    children.forEach((el) => {
      if (el && getComputedStyle(el).opacity === "0" && isElementInViewport(el)) {
        snapEnterFinalState(el);
      }
    });
  }, 3200);

  return {
    revert() {
      clearTimeout(safetyId);
      combined.revert();
    }
  };
}

/** Snap all set-piece elements to final visible state (reduced motion helper). */
export function snapSetPieceRefs(refs) {
  const els = Object.values(refs || {})
    .flat()
    .filter((v) => v && typeof v === "object" && "style" in v);
  snapEnterFinalState(null, els);
}
