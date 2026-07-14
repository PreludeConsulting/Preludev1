/** Flat section list for the homepage section navigator. */
export const HOMEPAGE_SCROLL_SECTIONS = [
  { id: "home", label: "Hero" },
  { id: "partners", label: "Universities" },
  { id: "how-it-works", label: "How It Works" },
  { id: "mentorship", label: "Mentors" },
  { id: "pricing", label: "Pricing" },
  { id: "bundles", label: "Bundles" },
  { id: "contact", label: "Contact" }
];

const VIEWPORT_ANCHOR = 0.42;

/** Center viewport band used for dominance scoring (25%–75% height). */
export const SECTION_CENTER_BAND_TOP = 0.25;
export const SECTION_CENTER_BAND_BOTTOM = 0.75;

export const SECTION_OBSERVER_ROOT_MARGIN = "-25% 0px -25% 0px";
export const SECTION_OBSERVER_THRESHOLDS = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1];
export const SECTION_MIN_ACTIVE_RATIO = 0.3;
export const SECTION_SWITCH_HYSTERESIS = 0.08;
export const ACTIVE_LABEL_IDLE_MS = 2200;
export const FILL_LERP_ALPHA = 0.22;
export const FILL_LERP_EPSILON = 0.0004;

export function getMaxScrollHeight() {
  if (typeof window === "undefined") return 1;
  return Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
}

/** Active section index for a document scroll progress value (0–1). Shared by fill + ticks. */
export function resolveActiveSectionAtProgress(progress, sections) {
  if (!sections?.length) return 0;
  const p = Math.max(0, Math.min(1, progress));
  let index = 0;

  for (let i = 0; i < sections.length; i += 1) {
    if (p + 0.0001 >= sections[i].ratio) index = i;
  }

  return index;
}

/** Linear scroll progress (0–1) across the document. */
export function getDocumentScrollProgress() {
  if (typeof window === "undefined") return 0;
  return Math.max(0, Math.min(1, window.scrollY / getMaxScrollHeight()));
}

/** Ease-out lerp for smooth progress fill without overshoot. */
export function lerpScrollProgress(current, target, alpha = FILL_LERP_ALPHA) {
  if (alpha >= 1) return target;
  const next = current + (target - current) * alpha;
  if (Math.abs(target - next) <= FILL_LERP_EPSILON) return target;
  return next;
}

/** Resolve the DOM node for a nav section (individual section element, not layout wrappers). */
export function getHomepageSectionElement(section) {
  if (typeof document === "undefined" || !section?.id) return null;
  const el = document.getElementById(section.id);
  if (!el) return null;
  if (el.matches("section, [data-section-nav]")) return el;
  return el;
}

/** Measure each section's document offset and proportional rail position. */
export function measureHomepageSections() {
  const maxScroll = getMaxScrollHeight();

  return HOMEPAGE_SCROLL_SECTIONS.map((section, index) => {
    const el = getHomepageSectionElement(section);
    const top = el ? el.getBoundingClientRect().top + window.scrollY : 0;

    return {
      ...section,
      index,
      top,
      ratio: Math.max(0, Math.min(1, top / maxScroll))
    };
  });
}

/** Fallback active index from scroll position when nothing intersects the observer band. */
export function resolveActiveSectionByScrollProbe(sections) {
  if (typeof window === "undefined" || !sections?.length) return 0;
  const probe = window.scrollY + window.innerHeight * VIEWPORT_ANCHOR;
  let activeIndex = 0;

  for (let i = 0; i < sections.length; i += 1) {
    if (probe >= sections[i].top) activeIndex = i;
  }

  return activeIndex;
}

/**
 * Pick the active section from center-viewport dominance scores (0–1).
 * Only sections at or above SECTION_MIN_ACTIVE_RATIO qualify.
 * Hysteresis prevents flicker when scores are close at boundaries.
 */
export function resolveActiveSectionFromRatios(ratioById, sections, currentIndex = -1) {
  if (!sections?.length) return 0;

  let bestIndex = -1;
  let bestRatio = 0;

  sections.forEach((section, index) => {
    const ratio = ratioById.get(section.id) ?? 0;
    if (ratio < SECTION_MIN_ACTIVE_RATIO) return;

    if (
      ratio > bestRatio + 0.0001 ||
      (Math.abs(ratio - bestRatio) <= 0.0001 && (bestIndex < 0 || index < bestIndex))
    ) {
      bestRatio = ratio;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0) {
    if (currentIndex >= 0 && bestIndex !== currentIndex) {
      const currentScore = ratioById.get(sections[currentIndex].id) ?? 0;
      const bestScore = ratioById.get(sections[bestIndex].id) ?? 0;
      if (currentScore > 0.15 && bestScore < currentScore + SECTION_SWITCH_HYSTERESIS) {
        return currentIndex;
      }
    }
    return bestIndex;
  }

  return resolveActiveSectionByScrollProbe(sections);
}

/**
 * Fraction of the viewport center band (25%–75%) occupied by a section (0–1).
 * Section-height independent — measures visual dominance in the middle of the screen.
 */
export function getViewportDominance(entry) {
  if (!entry?.isIntersecting) return 0;

  const vh = entry.rootBounds?.height ?? 0;
  const vw = entry.rootBounds?.width ?? 0;
  if (vh <= 0 || vw <= 0) return 0;

  const bandTop = vh * SECTION_CENTER_BAND_TOP;
  const bandBottom = vh * SECTION_CENTER_BAND_BOTTOM;
  const bandHeight = bandBottom - bandTop;
  if (bandHeight <= 0) return 0;

  const rect = entry.boundingClientRect;
  const overlapTop = Math.max(rect.top, bandTop);
  const overlapBottom = Math.min(rect.bottom, bandBottom);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);
  const overlapLeft = Math.max(rect.left, 0);
  const overlapRight = Math.min(rect.right, vw);
  const overlapWidth = Math.max(0, overlapRight - overlapLeft);

  const bandArea = bandHeight * vw;
  if (bandArea <= 0) return 0;

  return Math.max(0, Math.min(1, (overlapHeight * overlapWidth) / bandArea));
}

/** @deprecated Use getViewportDominance */
export function getBandCoverage(entry) {
  return getViewportDominance(entry);
}

/**
 * Attach IntersectionObserver to each flat homepage section element.
 * Returns remeasure/disconnect helpers and the current active index.
 */
export function attachHomepageSectionTracker({ onActiveChange } = {}) {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
    return {
      remeasure() {},
      disconnect() {},
      getActiveIndex: () => 0,
      getSections: () => []
    };
  }

  let sections = measureHomepageSections();
  let activeIndex = resolveActiveSectionByScrollProbe(sections);
  const ratioById = new Map();
  const observed = [];

  const emit = (force = false) => {
    const nextIndex = resolveActiveSectionFromRatios(ratioById, sections, activeIndex);
    if (!force && nextIndex === activeIndex) return;

    activeIndex = nextIndex;
    onActiveChange?.({
      activeIndex,
      section: sections[activeIndex],
      sections
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        if (!id) return;
        ratioById.set(id, getViewportDominance(entry));
      });
      emit();
    },
    {
      root: null,
      rootMargin: SECTION_OBSERVER_ROOT_MARGIN,
      threshold: SECTION_OBSERVER_THRESHOLDS
    }
  );

  const remeasure = () => {
    observed.forEach((el) => observer.unobserve(el));
    observed.length = 0;
    ratioById.clear();
    sections = measureHomepageSections();

    sections.forEach((section) => {
      const el = getHomepageSectionElement(section);
      if (!el) return;
      observed.push(el);
      observer.observe(el);
    });

    emit(true);
    return sections;
  };

  remeasure();

  return {
    remeasure,
    disconnect: () => {
      observer.disconnect();
      observed.length = 0;
      ratioById.clear();
    },
    getActiveIndex: () => activeIndex,
    getSections: () => sections
  };
}

/**
 * Map a rail click ratio to the section whose start is at or above that position.
 * Snaps to section tops, not arbitrary scroll offsets.
 */
export function resolveSectionIndexAtRatio(ratio, sections) {
  if (!sections?.length) return 0;
  const clamped = Math.max(0, Math.min(1, ratio));
  let index = 0;

  for (let i = 0; i < sections.length; i += 1) {
    if (clamped + 0.0001 >= sections[i].ratio) index = i;
  }

  return index;
}

/** Return section index when click lands within threshold of a tick, else -1. */
export function resolveSectionIndexNearRatio(ratio, sections, threshold = 0.028) {
  if (!sections?.length) return -1;
  const clamped = Math.max(0, Math.min(1, ratio));
  let nearest = -1;
  let minDistance = threshold;

  sections.forEach((section, index) => {
    const distance = Math.abs(section.ratio - clamped);
    if (distance <= minDistance) {
      minDistance = distance;
      nearest = index;
    }
  });

  return nearest;
}

export function scrollToHomepageSection(sectionId, { reducedMotion = false } = {}) {
  if (typeof window === "undefined") return;
  const el = getHomepageSectionElement({ id: sectionId });
  if (!el) return;

  el.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "start"
  });
}

/** Active section + linear scroll progress for the navigation rail. */
export function getHomepageScrollState(sections = measureHomepageSections()) {
  if (typeof window === "undefined") {
    return {
      progress: 0,
      label: HOMEPAGE_SCROLL_SECTIONS[0].label,
      activeIndex: 0
    };
  }

  const activeIndex = resolveActiveSectionByScrollProbe(sections);

  return {
    progress: getDocumentScrollProgress(),
    label: sections[activeIndex]?.label ?? HOMEPAGE_SCROLL_SECTIONS[0].label,
    activeIndex
  };
}

/** Resolve which homepage section is currently in view. */
export function resolveActiveScrollSection() {
  const { activeIndex } = getHomepageScrollState();
  return HOMEPAGE_SCROLL_SECTIONS[activeIndex] ?? HOMEPAGE_SCROLL_SECTIONS[0];
}
