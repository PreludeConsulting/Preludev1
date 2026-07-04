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
    for (const edge of edges) {
      expect(edge.id).toBe(
        edge.fromId < edge.toId ? `${edge.fromId}|${edge.toId}` : `${edge.toId}|${edge.fromId}`
      );
    }
  });

  it("produces a dense mesh for the full network", () => {
    const edges = buildNetworkEdges(points);
    expect(edges.length).toBeGreaterThanOrEqual(30);
    expect(edges.length).toBeLessThanOrEqual(45);
    for (const edge of edges) {
      expect(edge.d).toMatch(/^M .+ Q .+ .+ .+$/);
    }
  });

  it("uses fewer edges in compact density mode", () => {
    const full = buildNetworkEdges(points, { density: "default" });
    const compact = buildNetworkEdges(points, { density: "compact" });
    expect(compact.length).toBeLessThan(full.length);
    expect(compact.length).toBeGreaterThanOrEqual(25);
  });
});
