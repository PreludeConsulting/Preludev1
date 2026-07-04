import { describe, expect, it } from "vitest";
import { getNetworkMapPoints } from "../src/data/universityGeo.js";
import { buildNetworkEdges, curvedEdgePath } from "../src/lib/universityNetworkGraph.js";

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

  it("connects every node with exactly n - 1 edges", () => {
    const edges = buildNetworkEdges(points);
    expect(edges.length).toBe(points.length - 1);

    const connected = new Set();
    for (const edge of edges) {
      connected.add(edge.fromId);
      connected.add(edge.toId);
      expect(edge.d).toMatch(/^M .+ Q .+ .+ .+$/);
    }

    for (const point of points) {
      expect(connected.has(point.id)).toBe(true);
    }
  });
});
