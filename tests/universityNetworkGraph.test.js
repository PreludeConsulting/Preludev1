import { describe, expect, it } from "vitest";
import { getNetworkMapPoints } from "../src/data/universityGeo.js";
import {
  buildNetworkEdges,
  curvedEdgePath,
  edgeTone,
  getHubNodeIds,
  nodeTone
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

  it("assigns cyan or magenta tones", () => {
    const edges = buildNetworkEdges(points.slice(0, 8));
    for (const edge of edges) {
      expect(["cyan", "magenta"]).toContain(edge.tone);
      expect(edge.tone).toBe(edgeTone(edge.fromId, edge.toId));
    }
    expect(["cyan", "magenta"]).toContain(nodeTone(points[0].id));
  });

  it("produces a dense mesh for the full network", () => {
    const edges = buildNetworkEdges(points);
    expect(edges.length).toBeGreaterThanOrEqual(30);
    expect(edges.length).toBeLessThanOrEqual(45);
  });

  it("identifies hub nodes by degree", () => {
    const edges = buildNetworkEdges(points);
    const hubs = getHubNodeIds(edges, 4);
    expect(hubs.size).toBeGreaterThan(0);
  });

  it("uses fewer edges in compact density mode", () => {
    const full = buildNetworkEdges(points, { density: "default" });
    const compact = buildNetworkEdges(points, { density: "compact" });
    expect(compact.length).toBeLessThan(full.length);
  });
});
