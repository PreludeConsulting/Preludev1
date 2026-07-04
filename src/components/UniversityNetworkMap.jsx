import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  US_MAP_VIEWBOX,
  US_OUTLINE_PATH,
  getNetworkMapPoints
} from "../data/universityGeo.js";
import { buildNetworkEdges } from "../lib/universityNetworkGraph.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import {
  cancelNetworkMapTimeline,
  runNetworkDrawTimeline,
  runNetworkIdlePulse,
  snapNetworkVisible
} from "../lib/universityNetworkMapMotion.js";

const COMPACT_QUERY = "(max-width: 42rem)";

function useCompactDensity() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(COMPACT_QUERY).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = (event) => setCompact(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return compact;
}

export default function UniversityNetworkMap() {
  const reducedMotion = useReducedMotion();
  const compact = useCompactDensity();
  const sectionRef = useRef(null);
  const edgeRefs = useRef([]);
  const drawTimelineRef = useRef(null);
  const idleTimelineRef = useRef(null);
  const inViewRef = useRef(false);
  const hasActivatedRef = useRef(false);

  const points = useMemo(() => getNetworkMapPoints(), []);
  const edges = useMemo(
    () => buildNetworkEdges(points, { density: compact ? "compact" : "default" }),
    [points, compact]
  );

  const stopTimelines = useCallback(() => {
    cancelNetworkMapTimeline(drawTimelineRef);
    cancelNetworkMapTimeline(idleTimelineRef);
  }, []);

  const startIdlePulse = useCallback(() => {
    cancelNetworkMapTimeline(idleTimelineRef);
    if (reducedMotion || !inViewRef.current) return;
    idleTimelineRef.current = runNetworkIdlePulse({
      edgeEls: edgeRefs.current,
      reducedMotion
    });
  }, [reducedMotion]);

  const activateNetwork = useCallback(() => {
    stopTimelines();

    if (reducedMotion) {
      snapNetworkVisible(edgeRefs.current);
      hasActivatedRef.current = true;
      return;
    }

    if (hasActivatedRef.current) {
      startIdlePulse();
      return;
    }

    drawTimelineRef.current = runNetworkDrawTimeline({
      edgeEls: edgeRefs.current,
      reducedMotion,
      onComplete: () => {
        hasActivatedRef.current = true;
        drawTimelineRef.current = null;
        startIdlePulse();
      }
    });
  }, [reducedMotion, startIdlePulse, stopTimelines]);

  useEffect(() => {
    edgeRefs.current = edgeRefs.current.slice(0, edges.length);
  }, [edges]);

  useEffect(() => {
    hasActivatedRef.current = false;
    stopTimelines();
    if (inViewRef.current) {
      activateNetwork();
    }
  }, [edges, reducedMotion, activateNetwork, stopTimelines]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          activateNetwork();
          return;
        }
        stopTimelines();
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      stopTimelines();
    };
  }, [activateNetwork, stopTimelines]);

  const gridDots = useMemo(() => {
    const dots = [];
    for (let x = 40; x < US_MAP_VIEWBOX.width; x += 48) {
      for (let y = 40; y < US_MAP_VIEWBOX.height; y += 48) {
        dots.push({ x, y, key: `${x}-${y}` });
      }
    }
    return dots;
  }, []);

  return (
    <div ref={sectionRef} className="network-map">
      <svg
        className="network-map__svg"
        viewBox={`0 0 ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`}
        role="img"
        aria-label="Animated map of our university network across the United States"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="network-node-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="network-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="network-edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5ee7ff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#8b7cff" stopOpacity="0.75" />
          </linearGradient>
          <radialGradient id="network-node-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="55%" stopColor="#5ee7ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#8b7cff" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        <g className="network-map__ambient" aria-hidden="true">
          {gridDots.map((dot) => (
            <circle key={dot.key} className="network-map__grid-dot" cx={dot.x} cy={dot.y} r={0.6} />
          ))}
        </g>

        <path className="network-map__outline" d={US_OUTLINE_PATH} aria-hidden="true" />

        <g className="network-map__edges" aria-hidden="true">
          {edges.map((edge, index) => (
            <path
              key={edge.id}
              ref={(node) => {
                edgeRefs.current[index] = node;
              }}
              className="network-map__edge"
              d={edge.d}
              filter="url(#network-edge-glow)"
            />
          ))}
        </g>

        <g className="network-map__nodes">
          {points.map((point) => (
            <g key={point.id} className="network-map__node">
              <circle
                className="network-map__node-halo"
                cx={point.x}
                cy={point.y}
                r={8}
                filter="url(#network-node-glow)"
              />
              <circle
                className="network-map__node-core"
                cx={point.x}
                cy={point.y}
                r={3.2}
                fill="url(#network-node-core)"
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
