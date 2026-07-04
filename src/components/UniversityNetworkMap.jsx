import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  US_MAP_VIEWBOX,
  US_MAP_VIEWBOX_ATTR,
  US_NATION_PATH,
  US_STATE_PATHS,
  US_STATES_MESH_PATH,
  getNetworkMapPoints,
  NETWORK_SHOWCASE_CONNECTIONS
} from "../data/universityGeo.js";
import { buildNetworkEdges, orderEdgesForDrawAnimation } from "../lib/universityNetworkGraph.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import {
  cancelNetworkMapTimeline,
  resetNetworkEdges,
  runNetworkDrawCycle,
  snapNetworkVisible
} from "../lib/universityNetworkMapMotion.js";

export default function UniversityNetworkMap() {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const edgeRefs = useRef([]);
  const drawRef = useRef(null);
  const inViewRef = useRef(false);

  const points = useMemo(() => getNetworkMapPoints(), []);
  const edges = useMemo(() => {
    const built = buildNetworkEdges(points, {
      showcasePairs: NETWORK_SHOWCASE_CONNECTIONS,
      bounds: US_MAP_VIEWBOX
    });
    return orderEdgesForDrawAnimation(built, points);
  }, [points]);

  const setAnimatingClass = useCallback((active) => {
    const node = sectionRef.current;
    if (!node) return;
    node.classList.toggle("network-map--animating", active);
  }, []);

  const stopDraw = useCallback(() => {
    cancelNetworkMapTimeline(drawRef);
    setAnimatingClass(false);
  }, [setAnimatingClass]);

  const resetAnimation = useCallback(() => {
    if (reducedMotion) return;
    resetNetworkEdges(edgeRefs.current);
  }, [reducedMotion]);

  const startDraw = useCallback(() => {
    stopDraw();

    if (reducedMotion) {
      snapNetworkVisible(edgeRefs.current);
      return;
    }

    setAnimatingClass(true);
    drawRef.current = runNetworkDrawCycle({
      edgeEls: edgeRefs.current,
      reducedMotion
    });
  }, [reducedMotion, setAnimatingClass, stopDraw]);

  useEffect(() => {
    edgeRefs.current = edgeRefs.current.slice(0, edges.length);
    resetNetworkEdges(edgeRefs.current);
  }, [edges]);

  useEffect(() => {
    stopDraw();
    if (inViewRef.current) {
      startDraw();
    }
  }, [edges, reducedMotion, startDraw, stopDraw]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          startDraw();
          return;
        }
        stopDraw();
        resetAnimation();
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      stopDraw();
      resetAnimation();
    };
  }, [resetAnimation, startDraw, stopDraw]);

  return (
    <div
      ref={sectionRef}
      className="network-map"
      style={{ "--map-aspect-ratio": US_MAP_VIEWBOX.width / US_MAP_VIEWBOX.height }}
    >
      <div className="network-map__svg-wrap">
        <svg
          className="network-map__svg"
          viewBox={US_MAP_VIEWBOX_ATTR}
          role="img"
          aria-label="Animated map of our university network across the United States"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <clipPath id="network-map-clip">
              <rect
                x={US_MAP_VIEWBOX.x}
                y={US_MAP_VIEWBOX.y}
                width={US_MAP_VIEWBOX.width}
                height={US_MAP_VIEWBOX.height}
              />
            </clipPath>
          </defs>

          <g className="network-map__land" aria-hidden="true" clipPath="url(#network-map-clip)">
            {US_STATE_PATHS.map((state) => (
              <path key={state.id} className="network-map__state-fill" d={state.d} />
            ))}
            <path className="network-map__state-mesh" d={US_STATES_MESH_PATH} />
            <path className="network-map__outline" d={US_NATION_PATH} />
          </g>

          <g className="network-map__edges" aria-hidden="true" clipPath="url(#network-map-clip)">
            {edges.map((edge, index) => (
              <path
                key={edge.id}
                ref={(node) => {
                  edgeRefs.current[index] = node;
                }}
                className={
                  edge.tier === "showcase"
                    ? "network-map__edge network-map__edge--showcase"
                    : "network-map__edge"
                }
                d={edge.d}
              />
            ))}
          </g>

          <g className="network-map__nodes" clipPath="url(#network-map-clip)">
            {points.map((point) => (
              <g key={point.id} className="network-map__node">
                <circle className="network-map__node-halo" cx={point.x} cy={point.y} r={5.5} />
                <circle className="network-map__node-core" cx={point.x} cy={point.y} r={2.4} />
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
