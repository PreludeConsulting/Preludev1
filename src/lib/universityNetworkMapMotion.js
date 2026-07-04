import { createTimeline, stagger } from "animejs";

export const MAP_MOTION_MS = {
  draw: 820,
  stagger: 55,
  idlePulse: 4000
};

export const MAP_EASE = "out(4)";

function prepareEdge(el) {
  if (!el) return 0;
  const length = el.getTotalLength();
  el.style.strokeDasharray = `${length}`;
  el.style.strokeDashoffset = `${length}`;
  return length;
}

/**
 * Snap all edges to fully drawn, visible state.
 * @param {SVGPathElement[]} edgeEls
 */
export function snapNetworkVisible(edgeEls) {
  edgeEls.filter(Boolean).forEach((el) => {
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = "0";
    el.style.opacity = "0.72";
  });
}

/**
 * Staggered mesh edge draw-in via anime.js.
 * @param {{ edgeEls: SVGPathElement[], reducedMotion?: boolean, onComplete?: () => void }} opts
 * @returns {import('animejs').Timeline | null}
 */
export function runNetworkDrawTimeline({ edgeEls, reducedMotion = false, onComplete }) {
  const edges = edgeEls.filter(Boolean);

  if (reducedMotion || edges.length === 0) {
    snapNetworkVisible(edges);
    onComplete?.();
    return null;
  }

  edges.forEach((el) => prepareEdge(el));

  const tl = createTimeline({ defaults: { ease: MAP_EASE } });
  tl.add(
    edges,
    {
      strokeDashoffset: (el) => ({ from: el.getTotalLength(), to: 0 }),
      duration: MAP_MOTION_MS.draw
    },
    stagger(MAP_MOTION_MS.stagger)
  );

  if (onComplete) {
    tl.then(onComplete);
  }

  return tl;
}

/**
 * Subtle idle opacity pulse on drawn edges — no geometry replay.
 * @param {{ edgeEls: SVGPathElement[], reducedMotion?: boolean }} opts
 * @returns {import('animejs').Timeline | null}
 */
export function runNetworkIdlePulse({ edgeEls, reducedMotion = false }) {
  const edges = edgeEls.filter(Boolean);
  if (reducedMotion || edges.length === 0) return null;

  edges.forEach((el) => {
    el.style.opacity = "0.72";
  });

  const tl = createTimeline({
    defaults: { ease: "inOut(2)" },
    loop: true,
    alternate: true
  });

  tl.add(edges, {
    opacity: { from: 0.55, to: 0.85 },
    duration: MAP_MOTION_MS.idlePulse
  });

  return tl;
}

export function cancelNetworkMapTimeline(timelineRef) {
  const active = timelineRef.current;
  if (!active) return;
  active.cancel();
  timelineRef.current = null;
}
