import { createTimeline } from "animejs";

export const MAP_MOTION_MS = {
  line: 900,
  marker: 280,
  stagger: 90,
  loopPause: 2400
};

export const MAP_EASE = "out(4)";

function prepareLine(el) {
  if (!el) return 0;
  const length = el.getTotalLength();
  el.style.strokeDasharray = `${length}`;
  el.style.strokeDashoffset = `${length}`;
  return length;
}

function snapLinesVisible(lineEls) {
  lineEls.forEach((el) => {
    if (!el) return;
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = "0";
  });
}

function snapMarkersVisible(markerEls) {
  markerEls.forEach((el) => {
    if (el) el.style.opacity = "1";
  });
}

/**
 * Streak connector lines from hub to each university marker via anime.js.
 * @param {{ lineEls: SVGPathElement[], markerEls?: SVGCircleElement[], reducedMotion?: boolean, onComplete?: () => void }} opts
 * @returns {import('animejs').Timeline | null}
 */
export function runNetworkMapTimeline({ lineEls, markerEls = [], reducedMotion = false, onComplete }) {
  const lines = lineEls.filter(Boolean);
  const markers = markerEls.filter(Boolean);

  if (reducedMotion || lines.length === 0) {
    snapLinesVisible(lines);
    snapMarkersVisible(markers);
    onComplete?.();
    return null;
  }

  lines.forEach((el) => prepareLine(el));
  markers.forEach((el) => {
    el.style.opacity = "0";
  });

  const tl = createTimeline({ defaults: { ease: MAP_EASE } });

  lines.forEach((el, index) => {
    const length = el.getTotalLength();
    tl.add(
      el,
      {
        strokeDashoffset: { from: length, to: 0 },
        duration: MAP_MOTION_MS.line
      },
      index * MAP_MOTION_MS.stagger
    );
  });

  if (markers.length) {
    tl.add(
      markers,
      { opacity: { from: 0, to: 1 }, duration: MAP_MOTION_MS.marker },
      MAP_MOTION_MS.stagger * 0.4
    );
  }

  if (onComplete) {
    tl.then(onComplete);
  }

  return tl;
}

export function cancelNetworkMapTimeline(timelineRef) {
  const active = timelineRef.current;
  if (!active) return;
  active.cancel();
  timelineRef.current = null;
}
