import { createTimeline, stagger } from "animejs";

export const MAP_MOTION_MS = {
  draw: 640,
  stagger: 8,
  pulse: 2200
};

export const MAP_EASE = "out(4)";

function prepareEdge(el) {
  if (!el) return 0;
  const length = el.getTotalLength();
  el.style.strokeDasharray = `${length}`;
  el.style.strokeDashoffset = `${length}`;
  el.style.opacity = "0.38";
  return length;
}

export function resetNetworkEdges(edgeEls) {
  edgeEls.filter(Boolean).forEach((el) => prepareEdge(el));
}

export function snapNetworkVisible(edgeEls) {
  edgeEls.filter(Boolean).forEach((el) => {
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = "0";
    el.style.opacity = "0.52";
  });
}

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
      opacity: { from: 0.38, to: 0.52 },
      duration: MAP_MOTION_MS.draw
    },
    stagger(MAP_MOTION_MS.stagger)
  );

  if (onComplete) {
    tl.then(onComplete);
  }

  return tl;
}

/** One draw-in per viewport entry; idle pulse is handled via CSS on the edges group. */
export function runNetworkDrawCycle({ edgeEls, reducedMotion = false }) {
  const edges = edgeEls.filter(Boolean);
  if (reducedMotion || edges.length === 0) {
    snapNetworkVisible(edges);
    return null;
  }

  let drawTimeline = null;

  const stopDraw = () => {
    if (drawTimeline) {
      drawTimeline.cancel();
      drawTimeline = null;
    }
  };

  drawTimeline = runNetworkDrawTimeline({
    edgeEls: edges,
    reducedMotion: false,
    onComplete: () => {
      drawTimeline = null;
    }
  });

  return {
    cancel() {
      stopDraw();
    }
  };
}

/** @deprecated Use runNetworkDrawCycle — kept for test compatibility. */
export function runNetworkCycleLoop(options) {
  return runNetworkDrawCycle(options);
}

export function cancelNetworkMapTimeline(timelineRef) {
  const active = timelineRef.current;
  if (!active) return;
  active.cancel();
  timelineRef.current = null;
}
