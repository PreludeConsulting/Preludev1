import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  NETWORK_HUB,
  US_MAP_VIEWBOX,
  US_OUTLINE_PATH,
  getNetworkMapPoints,
  projectLatLon
} from "../data/universityGeo.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import {
  MAP_MOTION_MS,
  cancelNetworkMapTimeline,
  runNetworkMapTimeline
} from "../lib/universityNetworkMapMotion.js";

export default function UniversityNetworkMap() {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const lineRefs = useRef([]);
  const markerRefs = useRef([]);
  const timelineRef = useRef(null);
  const inViewRef = useRef(false);
  const loopTimerRef = useRef(null);

  const hub = useMemo(() => projectLatLon(NETWORK_HUB.lat, NETWORK_HUB.lon), []);
  const points = useMemo(() => getNetworkMapPoints(), []);

  const playTimeline = useCallback(() => {
    cancelNetworkMapTimeline(timelineRef);
    runNetworkMapTimeline({
      lineEls: lineRefs.current,
      markerEls: markerRefs.current,
      reducedMotion,
      onComplete: () => {
        if (!inViewRef.current || reducedMotion) return;
        loopTimerRef.current = window.setTimeout(() => {
          if (inViewRef.current) playTimeline();
        }, MAP_MOTION_MS.loopPause);
      }
    });
  }, [reducedMotion]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          playTimeline();
          return;
        }
        cancelNetworkMapTimeline(timelineRef);
        if (loopTimerRef.current) {
          window.clearTimeout(loopTimerRef.current);
          loopTimerRef.current = null;
        }
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelNetworkMapTimeline(timelineRef);
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
    };
  }, [playTimeline]);

  return (
    <div ref={sectionRef} className="network-map">
      <svg
        className="network-map__svg"
        viewBox={`0 0 ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`}
        role="img"
        aria-label="Map showing our university network across the United States"
        preserveAspectRatio="xMidYMid meet"
      >
        <path className="network-map__land" d={US_OUTLINE_PATH} />
        <circle className="network-map__hub" cx={hub.x} cy={hub.y} r={5} />
        {points.map((point, index) => {
          const d = `M ${hub.x} ${hub.y} L ${point.x} ${point.y}`;
          return (
            <g key={point.id} className="network-map__connection">
              <path
                ref={(node) => {
                  lineRefs.current[index] = node;
                }}
                className="network-map__line"
                d={d}
              />
              <circle
                ref={(node) => {
                  markerRefs.current[index] = node;
                }}
                className="network-map__marker"
                cx={point.x}
                cy={point.y}
                r={4.5}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
