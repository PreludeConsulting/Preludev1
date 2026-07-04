/** @typedef {{ id: string, x: number, y: number }} NetworkPoint */

/**
 * @typedef {{ id: string, fromId: string, toId: string, d: string }} NetworkEdge
 */

const DEFAULT_K = 3;
const COMPACT_K = 2;
const MAX_EDGES = 45;

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function curvedEdgePath(ax, ay, bx, by, seed = 0) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sign = seed % 2 === 0 ? 1 : -1;
  const offset = len * 0.12 * sign;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

export function buildNetworkEdges(points, options = {}) {
  const { density = "default", maxEdges = MAX_EDGES } = options;
  const k = density === "compact" ? COMPACT_K : DEFAULT_K;
  const byId = new Map(points.map((p) => [p.id, p]));
  const seen = new Set();
  const edges = [];
  let seed = 0;

  for (const point of points) {
    const neighbors = points
      .filter((other) => other.id !== point.id)
      .map((other) => ({ other, dist: distance(point, other) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k);

    for (const { other } of neighbors) {
      const key = edgeKey(point.id, other.id);
      if (seen.has(key)) continue;
      seen.add(key);

      const from = byId.get(point.id);
      const to = byId.get(other.id);
      if (!from || !to) continue;

      edges.push({
        id: key,
        fromId: point.id,
        toId: other.id,
        d: curvedEdgePath(from.x, from.y, to.x, to.y, seed++)
      });

      if (edges.length >= maxEdges) return edges;
    }
  }

  return edges;
}
