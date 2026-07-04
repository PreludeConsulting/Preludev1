import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  US_MAP_VIEWBOX,
  US_NATION_PATH,
  US_STATE_PATHS,
  US_STATES_MESH_PATH,
  getNetworkMapPoints
} from "../data/universityGeo.js";
import { buildNetworkEdges } from "../lib/universityNetworkGraph.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import {
  cancelNetworkMapTimeline,
  resetNetworkEdges,
  runNetworkCycleLoop,
  snapNetworkVisible
} from "../lib/universityNetworkMapMotion.js";

const WAVE_PATHS = {
  left: "M -20 520 C 80 420, 120 320, 180 220 S 260 80, 320 -20",
  right: "M 995 520 C 895 420, 855 320, 795 220 S 715 80, 655 -20"
};

export default function UniversityNetworkMap() {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const edgeRefs = useRef([]);
  const cycleRef = useRef(null);
  const inViewRef = useRef(false);

  const points = useMemo(() => getNetworkMapPoints(), []);
  const edges = useMemo(() => buildNetworkEdges(points), [points]);

  const stopCycle = useCallback(() => {
    cancelNetworkMapTimeline(cycleRef);
  }, []);

  const resetAnimation = useCallback(() => {
    if (reducedMotion) return;
    resetNetworkEdges(edgeRefs.current);
  }, [reducedMotion]);

  const startCycle = useCallback(() => {
    stopCycle();

    if (reducedMotion) {
      snapNetworkVisible(edgeRefs.current);
      return;
    }

    cycleRef.current = runNetworkCycleLoop({
      edgeEls: edgeRefs.current,
      reducedMotion
    });
  }, [reducedMotion, stopCycle]);

  useEffect(() => {
    edgeRefs.current = edgeRefs.current.slice(0, edges.length);
  }, [edges]);

  useEffect(() => {
    stopCycle();
    if (inViewRef.current) {
      startCycle();
    }
  }, [edges, reducedMotion, startCycle, stopCycle]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          startCycle();
          return;
        }
        stopCycle();
        resetAnimation();
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      stopCycle();
      resetAnimation();
    };
  }, [resetAnimation, startCycle, stopCycle]);

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
          <filter id="network-outline-glow" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="network-node-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="network-edge-glow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="network-map__waves" aria-hidden="true">
          <path className="network-map__wave network-map__wave--left" d={WAVE_PATHS.left} />
          <path className="network-map__wave network-map__wave--right" d={WAVE_PATHS.right} />
        </g>

        <g className="network-map__land" aria-hidden="true">
          {US_STATE_PATHS.map((state) => (
            <path key={state.id} className="network-map__state-fill" d={state.d} />
          ))}
          <path className="network-map__state-mesh" d={US_STATES_MESH_PATH} />
          <path
            className="network-map__outline"
            d={US_NATION_PATH}
            filter="url(#network-outline-glow)"
          />
        </g>

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
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
