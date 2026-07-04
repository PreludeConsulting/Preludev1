import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  US_MAP_VIEWBOX,
  US_NATION_PATH,
  US_STATE_PATHS,
  US_STATES_MESH_PATH,
  getNetworkMapPoints
} from "../data/universityGeo.js";
import {
  buildNetworkEdges,
  getHubNodeIds,
  nodeTone
} from "../lib/universityNetworkGraph.js";
import { buildStardustPoints } from "../lib/universityNetworkStardust.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import {
  cancelNetworkMapTimeline,
  runNetworkDrawTimeline,
  runNetworkIdleLoops,
  snapHubNodesVisible,
  snapNetworkVisible,
  snapStardustVisible
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
  const hubRefs = useRef([]);
  const stardustRefs = useRef([]);
  const drawTimelineRef = useRef(null);
  const idleTimelineRef = useRef(null);
  const inViewRef = useRef(false);
  const hasActivatedRef = useRef(false);

  const points = useMemo(() => getNetworkMapPoints(), []);
  const edges = useMemo(
    () => buildNetworkEdges(points, { density: compact ? "compact" : "default" }),
    [points, compact]
  );
  const hubIds = useMemo(() => getHubNodeIds(edges), [edges]);
  const hubIndexById = useMemo(() => {
    const hubPoints = points.filter((point) => hubIds.has(point.id));
    return Object.fromEntries(hubPoints.map((point, index) => [point.id, index]));
  }, [points, hubIds]);

  const stardust = useMemo(
    () =>
      buildStardustPoints({
        width: US_MAP_VIEWBOX.width,
        height: US_MAP_VIEWBOX.height,
        count: compact ? 420 : 960,
        seed: 42
      }),
    [compact]
  );

  const stopTimelines = useCallback(() => {
    cancelNetworkMapTimeline(drawTimelineRef);
    cancelNetworkMapTimeline(idleTimelineRef);
  }, []);

  const startIdleLoops = useCallback(() => {
    cancelNetworkMapTimeline(idleTimelineRef);
    if (reducedMotion || !inViewRef.current) return;
    idleTimelineRef.current = runNetworkIdleLoops({
      edgeEls: edgeRefs.current,
      hubEls: hubRefs.current,
      stardustEls: stardustRefs.current,
      reducedMotion
    });
  }, [reducedMotion]);

  const snapAllVisible = useCallback(() => {
    snapNetworkVisible(edgeRefs.current);
    snapHubNodesVisible(hubRefs.current);
    snapStardustVisible(stardustRefs.current);
  }, []);

  const activateNetwork = useCallback(() => {
    stopTimelines();

    if (reducedMotion) {
      snapAllVisible();
      hasActivatedRef.current = true;
      return;
    }

    if (hasActivatedRef.current) {
      startIdleLoops();
      return;
    }

    drawTimelineRef.current = runNetworkDrawTimeline({
      edgeEls: edgeRefs.current,
      reducedMotion,
      onComplete: () => {
        hasActivatedRef.current = true;
        drawTimelineRef.current = null;
        startIdleLoops();
      }
    });
  }, [reducedMotion, snapAllVisible, startIdleLoops, stopTimelines]);

  useEffect(() => {
    edgeRefs.current = edgeRefs.current.slice(0, edges.length);
    hubRefs.current = hubRefs.current.slice(0, Object.keys(hubIndexById).length);
    stardustRefs.current = stardustRefs.current.slice(0, stardust.length);
  }, [edges, stardust, hubIndexById]);

  useEffect(() => {
    hasActivatedRef.current = false;
    stopTimelines();
    if (inViewRef.current) {
      activateNetwork();
    }
  }, [edges, stardust, reducedMotion, activateNetwork, stopTimelines]);

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
          <clipPath id="network-us-clip">
            <path d={US_NATION_PATH} />
          </clipPath>
          <filter id="network-outline-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="network-node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="network-hub-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="network-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="network-node-core-cyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="45%" stopColor="#00f2ff" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#00f2ff" stopOpacity="0.35" />
          </radialGradient>
          <radialGradient id="network-node-core-magenta" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="45%" stopColor="#ff00ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ff00ff" stopOpacity="0.35" />
          </radialGradient>
        </defs>

        <g className="network-map__land" aria-hidden="true">
          <g className="network-map__stardust" clipPath="url(#network-us-clip)">
            {stardust.map((dot, index) => (
              <circle
                key={dot.id}
                ref={(node) => {
                  stardustRefs.current[index] = node;
                }}
                className="network-map__stardust-dot"
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                opacity={dot.opacity}
                data-base-opacity={dot.opacity}
              />
            ))}
          </g>

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
              className={`network-map__edge network-map__edge--${edge.tone}`}
              d={edge.d}
              filter="url(#network-edge-glow)"
            />
          ))}
        </g>

        <g className="network-map__nodes">
          {points.map((point) => {
            const tone = nodeTone(point.id);
            const isHub = hubIds.has(point.id);
            return (
              <g
                key={point.id}
                className={`network-map__node network-map__node--${tone}${isHub ? " network-map__node--hub" : ""}`}
              >
                {isHub ? (
                  <g
                    ref={(node) => {
                      const index = hubIndexById[point.id];
                      if (node && index !== undefined) hubRefs.current[index] = node;
                    }}
                    className="network-map__node-hub"
                  >
                    <circle
                      className="network-map__node-burst"
                      cx={point.x}
                      cy={point.y}
                      r={14}
                      filter="url(#network-hub-glow)"
                    />
                    <circle className="network-map__node-ring" cx={point.x} cy={point.y} r={10} />
                    <circle className="network-map__node-ring network-map__node-ring--inner" cx={point.x} cy={point.y} r={6.5} />
                  </g>
                ) : (
                  <circle
                    className="network-map__node-halo"
                    cx={point.x}
                    cy={point.y}
                    r={7}
                    filter="url(#network-node-glow)"
                  />
                )}
                <circle
                  className="network-map__node-core"
                  cx={point.x}
                  cy={point.y}
                  r={isHub ? 4.2 : 2.8}
                  fill={`url(#network-node-core-${tone})`}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
