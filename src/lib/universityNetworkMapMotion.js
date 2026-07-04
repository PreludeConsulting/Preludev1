import { createTimeline, stagger } from "animejs";

export const MAP_MOTION_MS = {
  draw: 820,
  stagger: 55,
  idlePulse: 4000,
  hubBreathe: 3200,
  stardustTwinkle: 7000
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
    el.style.opacity = "0.72";
  });
}

export function snapHubNodesVisible(hubEls) {
  hubEls.filter(Boolean).forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "scale(1)";
  });
}

export function snapStardustVisible(stardustEls) {
  stardustEls.filter(Boolean).forEach((el) => {
    el.style.opacity = el.dataset.baseOpacity || "0.25";
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

export function runHubBreatheTimeline({ hubEls, reducedMotion = false }) {
  const hubs = hubEls.filter(Boolean);
  if (reducedMotion || hubs.length === 0) return null;

  hubs.forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "scale(1)";
  });

  const tl = createTimeline({
    defaults: { ease: "inOut(2)" },
    loop: true,
    alternate: true
  });

  tl.add(hubs, {
    opacity: { from: 0.75, to: 1 },
    scale: { from: 0.92, to: 1.08 },
    duration: MAP_MOTION_MS.hubBreathe
  });

  return tl;
}

export function runStardustTwinkleTimeline({ stardustEls, reducedMotion = false }) {
  const dots = stardustEls.filter(Boolean);
  if (reducedMotion || dots.length === 0) return null;

  dots.forEach((el) => {
    if (!el.dataset.baseOpacity) {
      el.dataset.baseOpacity = el.getAttribute("opacity") || "0.25";
    }
  });

  const tl = createTimeline({
    defaults: { ease: "inOut(1)" },
    loop: true,
    alternate: true
  });

  tl.add(dots, {
    opacity: (el) => {
      const base = parseFloat(el.dataset.baseOpacity || "0.25");
      return { from: base * 0.55, to: base * 1.35 };
    },
    duration: MAP_MOTION_MS.stardustTwinkle,
    delay: stagger(12)
  });

  return tl;
}

export function runNetworkIdleLoops({
  edgeEls,
  hubEls = [],
  stardustEls = [],
  reducedMotion = false
}) {
  if (reducedMotion) {
    snapNetworkVisible(edgeEls);
    snapHubNodesVisible(hubEls);
    snapStardustVisible(stardustEls);
    return null;
  }

  const tl = createTimeline();
  const edgeTl = runNetworkIdlePulse({ edgeEls, reducedMotion });
  const hubTl = runHubBreatheTimeline({ hubEls, reducedMotion });
  const starTl = runStardustTwinkleTimeline({ stardustEls, reducedMotion });

  if (edgeTl) tl.sync(edgeTl);
  if (hubTl) tl.sync(hubTl);
  if (starTl) tl.sync(starTl);

  return tl;
}

export function cancelNetworkMapTimeline(timelineRef) {
  const active = timelineRef.current;
  if (!active) return;
  active.cancel();
  timelineRef.current = null;
}
