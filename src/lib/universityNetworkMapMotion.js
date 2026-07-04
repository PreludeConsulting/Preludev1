import { createTimeline, stagger } from "animejs";

export const MAP_MOTION_MS = {
  draw: 640,
  stagger: 8,
  pulse: 2200,
  cycle: 10000
};

export const MAP_EASE = "out(4)";

function prepareEdge(el) {
  if (!el) return 0;
  const length = el.getTotalLength();
  el.style.strokeDasharray = `${length}`;
  el.style.strokeDashoffset = `${length}`;
  el.style.opacity = "0.18";
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
    el.style.opacity = "0.32";
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
      opacity: { from: 0.18, to: 0.32 },
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
    el.style.opacity = "0.32";
  });

  const tl = createTimeline({
    defaults: { ease: "inOut(2)" },
    loop: true,
    alternate: true
  });

  tl.add(edges, {
    opacity: { from: 0.26, to: 0.36 },
    duration: MAP_MOTION_MS.pulse
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

/** Draw-in + pulse loop; full draw restarts every 10 seconds. */
export function runNetworkCycleLoop({ edgeEls, reducedMotion = false }) {
  const edges = edgeEls.filter(Boolean);
  if (reducedMotion || edges.length === 0) {
    snapNetworkVisible(edges);
    return null;
  }

  let cancelled = false;
  let drawTimeline = null;
  let pulseTimeline = null;
  let cycleTimer = null;

  const stopPulse = () => {
    if (pulseTimeline) {
      pulseTimeline.cancel();
      pulseTimeline = null;
    }
  };

  const stopDraw = () => {
    if (drawTimeline) {
      drawTimeline.cancel();
      drawTimeline = null;
    }
  };

  const startPulse = () => {
    if (cancelled) return;
    stopPulse();
    pulseTimeline = runNetworkIdlePulse({ edgeEls: edges, reducedMotion: false });
  };

  const playDraw = () => {
    if (cancelled) return;
    stopPulse();
    stopDraw();

    drawTimeline = runNetworkDrawTimeline({
      edgeEls: edges,
      reducedMotion: false,
      onComplete: () => {
        drawTimeline = null;
        startPulse();
      }
    });
  };

  playDraw();
  cycleTimer = setInterval(playDraw, MAP_MOTION_MS.cycle);

  return {
    cancel() {
      cancelled = true;
      if (cycleTimer) {
        clearInterval(cycleTimer);
        cycleTimer = null;
      }
      stopDraw();
      stopPulse();
    }
  };
}

export function cancelNetworkMapTimeline(timelineRef) {
  const active = timelineRef.current;
  if (!active) return;
  active.cancel();
  timelineRef.current = null;
}
