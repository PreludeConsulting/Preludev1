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

export function snapNetworkVisible(edgeEls) {
  edgeEls.filter(Boolean).forEach((el) => {
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = "0";
    el.style.opacity = "0.58";
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
      duration: MAP_MOTION_MS.draw
    },
    stagger(MAP_MOTION_MS.stagger)
  );

  if (onComplete) {
    tl.then(onComplete);
  }

  return tl;
}

export function runNetworkIdlePulse({ edgeEls, reducedMotion = false }) {
  const edges = edgeEls.filter(Boolean);
  if (reducedMotion || edges.length === 0) return null;

  edges.forEach((el) => {
    el.style.opacity = "0.58";
  });

  const tl = createTimeline({
    defaults: { ease: "inOut(2)" },
    loop: true,
    alternate: true
  });

  tl.add(edges, {
    opacity: { from: 0.42, to: 0.72 },
    duration: MAP_MOTION_MS.idlePulse
  });

  return tl;
}

export function runNetworkIdleLoops({ edgeEls, reducedMotion = false }) {
  if (reducedMotion) {
    snapNetworkVisible(edgeEls);
    return null;
  }

  return runNetworkIdlePulse({ edgeEls, reducedMotion });
}

export function cancelNetworkMapTimeline(timelineRef) {
  const active = timelineRef.current;
  if (!active) return;
  active.cancel();
  timelineRef.current = null;
}
