import { useEffect } from "react";
import {
  createEnterReveal,
  createScrollScrub,
  createStaggerReveal,
  SCROLL_OBSERVER_DEBUG
} from "./animeScrollMotion.js";
import { useReducedMotion } from "./useReducedMotion.js";

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
  const reducedMotion = useReducedMotion();

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
      handle = createEnterReveal(ref.current, { reducedMotion, debug, delay });
    };

    frame = requestAnimationFrame(tryMount);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      handle.revert();
    };
  }, [ref, reducedMotion, debug, delay]);
}

/** Staggered trigger-on-enter reveal for a container + its child refs. */
export function useScrollStaggerReveal(containerRef, childRefs, { debug = SCROLL_OBSERVER_DEBUG } = {}) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const children = childRefs.current || [];
    const handle = createStaggerReveal(containerRef.current, children, {
      reducedMotion,
      debug
    });
    return () => handle.revert();
  }, [containerRef, childRefs, reducedMotion, debug]);
}

/** Scroll-scrubbed animation tied to scroll progress through a section. */
export function useScrollScrubbedAnimation(targetRef, sectionRef, { props, debug = SCROLL_OBSERVER_DEBUG } = {}) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handle = createScrollScrub(targetRef.current, sectionRef.current, {
      reducedMotion,
      debug,
      props
    });
    return () => handle.revert();
  }, [targetRef, sectionRef, reducedMotion, debug, props]);
}

/**
 * Mount a Tier 2 set-piece preset; refs object is read on mount.
 * @param {(refs: object, options: { reducedMotion: boolean }) => { revert: () => void }} mountFn
 * @param {import('react').MutableRefObject<object>} refsRef
 */
export function useSetPieceAnimation(mountFn, refsRef) {
  const reducedMotion = useReducedMotion();

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
      handle = mountFn(refs, { reducedMotion }) || { revert() {} };
    };

    frame = requestAnimationFrame(tryMount);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      handle?.revert?.();
    };
  }, [mountFn, refsRef, reducedMotion]);
}
