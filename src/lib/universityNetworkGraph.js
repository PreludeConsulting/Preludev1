/** @typedef {{ id: string, x: number, y: number }} NetworkPoint */

/**
 * @typedef {{ id: string, fromId: string, toId: string, d: string }} NetworkEdge
 */

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

class UnionFind {
  constructor(ids) {
    this.parent = Object.fromEntries(ids.map((id) => [id, id]));
  }

  find(id) {
    if (this.parent[id] !== id) {
      this.parent[id] = this.find(this.parent[id]);
    }
    return this.parent[id];
  }

  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    this.parent[rootA] = rootB;
    return true;
  }
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

/** Connect every node via a minimum spanning tree (n nodes → n − 1 edges). */
export function buildNetworkEdges(points) {
  if (points.length < 2) return [];

  const byId = new Map(points.map((point) => [point.id, point]));
  const candidates = [];

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const from = points[i];
      const to = points[j];
      candidates.push({
        key: edgeKey(from.id, to.id),
        fromId: from.id,
        toId: to.id,
        dist: distance(from, to)
      });
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);

  const uf = new UnionFind(points.map((point) => point.id));
  const edges = [];
  let seed = 0;

  for (const candidate of candidates) {
    if (!uf.union(candidate.fromId, candidate.toId)) continue;

    const from = byId.get(candidate.fromId);
    const to = byId.get(candidate.toId);
    if (!from || !to) continue;

    edges.push({
      id: candidate.key,
      fromId: candidate.fromId,
      toId: candidate.toId,
      d: curvedEdgePath(from.x, from.y, to.x, to.y, seed++)
    });

    if (edges.length === points.length - 1) break;
  }

  return edges;
}
