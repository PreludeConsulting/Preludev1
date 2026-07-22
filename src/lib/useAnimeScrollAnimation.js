import { useEffect } from "react";
import {
  createEnterReveal,
  createScrollScrub,
  createStaggerReveal,
  SCROLL_OBSERVER_DEBUG
} from "./animeScrollMotion.js";
import { usePreludeMotion } from "../context/MotionContext.jsx";
import { shouldUseStaticLandingMotion } from "./motion/motionPolicy.js";

const MAX_MOUNT_ATTEMPTS = 24;
const REVERT_NOOP = { revert() {} };

function setPieceRefsReady(refs) {
  if (!refs) return false;
  if (refs.headlineWords?.length) return refs.headlineWords.some(Boolean);
  if (refs.headlineLines?.length) return refs.headlineLines.some(Boolean);
  if (refs.panelEls?.length) return refs.panelEls.some(Boolean);
  if (refs.headline) return true;
  if (refs.badge || refs.subtitle) return true;
  if (refs.statEls?.some?.(Boolean)) return true;
  if (refs.subcopy || refs.formWrap || refs.visual) return true;
  return false;
}

/** Trigger-on-enter reveal for a single element ref. */
export function useScrollEnterReveal(ref, { debug = SCROLL_OBSERVER_DEBUG, delay = 0 } = {}) {
  const { reducedMotion, motionTier } = usePreludeMotion();
  const staticMotion = shouldUseStaticLandingMotion({ reducedMotion, motionTier });

  useEffect(() => {
    let handle = REVERT_NOOP;
    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const tryMount = () => {
      if (cancelled) return;
      attempts += 1;
      if (!ref.current) {
        if (attempts < MAX_MOUNT_ATTEMPTS) frame = requestAnimationFrame(tryMount);
        return;
      }
      handle = createEnterReveal(ref.current, { reducedMotion: staticMotion, debug, delay });
    };

    frame = requestAnimationFrame(tryMount);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      handle.revert();
    };
  }, [ref, staticMotion, debug, delay]);
}

/** Staggered trigger-on-enter reveal for a container + its child refs. */
export function useScrollStaggerReveal(containerRef, childRefs, { debug = SCROLL_OBSERVER_DEBUG } = {}) {
  const { reducedMotion, motionTier } = usePreludeMotion();
  const staticMotion = shouldUseStaticLandingMotion({ reducedMotion, motionTier });

  useEffect(() => {
    const children = childRefs.current || [];
    const handle = createStaggerReveal(containerRef.current, children, {
      reducedMotion: staticMotion,
      debug
    });
    return () => handle.revert();
  }, [containerRef, childRefs, staticMotion, debug]);
}

/** Scroll-scrubbed animation tied to scroll progress through a section. */
export function useScrollScrubbedAnimation(targetRef, sectionRef, { props, debug = SCROLL_OBSERVER_DEBUG } = {}) {
  const { reducedMotion, motionTier } = usePreludeMotion();
  const staticMotion = shouldUseStaticLandingMotion({ reducedMotion, motionTier });

  useEffect(() => {
    const handle = createScrollScrub(targetRef.current, sectionRef.current, {
      reducedMotion: staticMotion,
      debug,
      props
    });
    return () => handle.revert();
  }, [targetRef, sectionRef, staticMotion, debug, props]);
}

/**
 * Mount a Tier 2 set-piece preset; refs object is read on mount.
 * @param {(refs: object, options: { reducedMotion: boolean }) => { revert: () => void }} mountFn
 * @param {import('react').MutableRefObject<object>} refsRef
 */
export function useSetPieceAnimation(mountFn, refsRef) {
  const { reducedMotion, motionTier } = usePreludeMotion();
  const staticMotion = shouldUseStaticLandingMotion({ reducedMotion, motionTier });

  useEffect(() => {
    let handle = { revert() {} };
    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const tryMount = () => {
      if (cancelled) return;
      attempts += 1;
      const refs = refsRef.current;
      if (!setPieceRefsReady(refs) && attempts < MAX_MOUNT_ATTEMPTS) {
        frame = requestAnimationFrame(tryMount);
        return;
      }
      handle = mountFn(refs, { reducedMotion: staticMotion }) || { revert() {} };
    };

    frame = requestAnimationFrame(tryMount);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      handle?.revert?.();
    };
  }, [mountFn, refsRef, staticMotion]);
}
