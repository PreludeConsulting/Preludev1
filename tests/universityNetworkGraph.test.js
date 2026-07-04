import { describe, expect, it } from "vitest";
import {
  getNetworkMapPoints,
  NETWORK_SHOWCASE_CONNECTIONS
} from "../src/data/universityGeo.js";
import {
  buildNetworkEdges,
  curvedEdgePath,
  getNetworkEdgeStats,
  MAX_DEGREE,
  orderEdgesForDrawAnimation
} from "../src/lib/universityNetworkGraph.js";

describe("universityNetworkGraph", () => {
  const points = getNetworkMapPoints();

  it("builds quadratic bezier paths", () => {
    const d = curvedEdgePath(10, 20, 100, 80, 0);
    expect(d).toMatch(/^M 10\.0 20\.0 Q .+ 100\.0 80\.0$/);
  });

  it("alternates curve direction by seed", () => {
    const a = curvedEdgePath(0, 0, 100, 0, 0);
    const b = curvedEdgePath(0, 0, 100, 0, 1);
    expect(a).not.toBe(b);
  });

  it("dedupes undirected edges", () => {
    const edges = buildNetworkEdges(points.slice(0, 6));
    const keys = edges.map((edge) => edge.id);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("builds a sparse connected network with capped degree", () => {
    const edges = buildNetworkEdges(points, { showcasePairs: NETWORK_SHOWCASE_CONNECTIONS });
    const stats = getNetworkEdgeStats(points, { showcasePairs: NETWORK_SHOWCASE_CONNECTIONS });
    const completeGraphCount = (points.length * (points.length - 1)) / 2;

    expect(edges.length).toBeGreaterThanOrEqual(points.length - 1);
    expect(edges.length).toBeLessThan(50);
    expect(edges.length).toBeLessThan(completeGraphCount);
    expect(stats.connected).toBe(true);
    expect(stats.maxObservedDegree).toBeLessThanOrEqual(MAX_DEGREE + 2);

    const degree = new Map(points.map((point) => [point.id, 0]));
    for (const edge of edges) {
      degree.set(edge.fromId, degree.get(edge.fromId) + 1);
      degree.set(edge.toId, degree.get(edge.toId) + 1);
      expect(edge.d).toMatch(/^M .+ Q .+ .+ .+$/);
    }

    for (const point of points) {
      expect(degree.get(point.id)).toBeGreaterThan(0);
      expect(degree.get(point.id)).toBeLessThanOrEqual(MAX_DEGREE + 2);
    }
  });

  it("includes showcase cross-country arcs", () => {
    const edges = buildNetworkEdges(points, { showcasePairs: NETWORK_SHOWCASE_CONNECTIONS });
    const keys = new Set(edges.map((edge) => edge.id));

    for (const [a, b] of NETWORK_SHOWCASE_CONNECTIONS) {
      expect(keys.has(a < b ? `${a}|${b}` : `${b}|${a}`)).toBe(true);
    }
  });

  it("orders edges for outward draw animation without dropping links", () => {
    const edges = buildNetworkEdges(points, { showcasePairs: NETWORK_SHOWCASE_CONNECTIONS });
    const ordered = orderEdgesForDrawAnimation(edges, points);

    expect(ordered.length).toBe(edges.length);
    expect(new Set(ordered.map((edge) => edge.id)).size).toBe(edges.length);
  });
});
