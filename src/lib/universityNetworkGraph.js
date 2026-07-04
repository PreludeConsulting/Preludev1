/** @typedef {{ id: string, x: number, y: number }} NetworkPoint */

/**
 * @typedef {{ id: string, fromId: string, toId: string, d: string }} NetworkEdge
 */

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
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

/** Connect every node to every other node (complete graph). */
export function buildNetworkEdges(points) {
  if (points.length < 2) return [];

  const byId = new Map(points.map((point) => [point.id, point]));
  const edges = [];
  let seed = 0;

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const from = points[i];
      const to = points[j];
      edges.push({
        id: edgeKey(from.id, to.id),
        fromId: from.id,
        toId: to.id,
        d: curvedEdgePath(from.x, from.y, to.x, to.y, seed++)
      });
    }
  }

  return edges;
}
