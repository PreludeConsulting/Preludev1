/** @typedef {{ id: string, x: number, y: number }} NetworkPoint */

/**
 * @typedef {{ id: string, fromId: string, toId: string, d: string }} NetworkEdge
 */

/** @typedef {[string, string]} ShowcasePair */

export const MAX_DEGREE = 2;

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function edgeSeed(fromId, toId) {
  const key = edgeKey(fromId, toId);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
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

  connected(a, b) {
    return this.find(a) === this.find(b);
  }
}

export function curvedEdgePath(ax, ay, bx, by, seed = 0, bounds = null) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sign = seed % 2 === 0 ? 1 : -1;
  const shortLink = len < 120;
  const offset = Math.min(len * (shortLink ? 0.24 : 0.1), shortLink ? 58 : 36) * sign;
  let cx = mx + nx * offset;
  let cy = my + ny * offset;

  if (bounds) {
    cx = Math.max(bounds.x, Math.min(bounds.x + bounds.width, cx));
    cy = Math.max(bounds.y, Math.min(bounds.y + bounds.height, cy));
  }

  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

function buildCandidatePairs(points) {
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
  return candidates;
}

function makeEdge(from, to, bounds, { tier = "local" } = {}) {
  return {
    id: edgeKey(from.id, to.id),
    fromId: from.id,
    toId: to.id,
    tier,
    d: curvedEdgePath(from.x, from.y, to.x, to.y, edgeSeed(from.id, to.id), bounds)
  };
}

function getDegrees(edges) {
  const degree = new Map();
  for (const edge of edges) {
    degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
    degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
  }
  return degree;
}

function canAddEdge(degree, fromId, toId, maxDegree) {
  return (degree.get(fromId) ?? 0) < maxDegree && (degree.get(toId) ?? 0) < maxDegree;
}

/**
 * Sparse network: MST backbone + optional showcase pairs + shortest bonus links
 * capped at maxDegree per node.
 */
export function buildNetworkEdges(points, { showcasePairs = [], maxDegree = MAX_DEGREE, bounds = null } = {}) {
  if (points.length < 2) return [];

  const byId = new Map(points.map((point) => [point.id, point]));
  const candidates = buildCandidatePairs(points);
  const selected = new Map();

  const addPair = (fromId, toId, tier = "local") => {
    const key = edgeKey(fromId, toId);
    if (selected.has(key)) return false;

    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) return false;

    selected.set(key, makeEdge(from, to, bounds, { tier }));
    return true;
  };

  const uf = new UnionFind(points.map((point) => point.id));
  for (const candidate of candidates) {
    if (!uf.union(candidate.fromId, candidate.toId)) continue;
    addPair(candidate.fromId, candidate.toId);
    if (selected.size === points.length - 1) break;
  }

  for (const [fromId, toId] of showcasePairs) {
    addPair(fromId, toId, "showcase");
  }

  const degree = getDegrees([...selected.values()]);
  for (const candidate of candidates) {
    if (selected.has(candidate.key)) continue;
    if (!canAddEdge(degree, candidate.fromId, candidate.toId, maxDegree)) continue;

    if (addPair(candidate.fromId, candidate.toId)) {
      degree.set(candidate.fromId, (degree.get(candidate.fromId) ?? 0) + 1);
      degree.set(candidate.toId, (degree.get(candidate.toId) ?? 0) + 1);
    }
  }

  return [...selected.values()];
}

/** BFS order from map center so edges draw outward like the network growing. */
export function orderEdgesForDrawAnimation(edges, points) {
  if (edges.length <= 1 || points.length === 0) return edges;

  const byId = new Map(points.map((point) => [point.id, point]));
  const adjacency = new Map(points.map((point) => [point.id, []]));

  for (const edge of edges) {
    adjacency.get(edge.fromId)?.push({ neighbor: edge.toId, edge });
    adjacency.get(edge.toId)?.push({ neighbor: edge.fromId, edge });
  }

  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;

  let startId = points[0].id;
  let bestDist = Infinity;
  for (const point of points) {
    const dist = (point.x - cx) ** 2 + (point.y - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      startId = point.id;
    }
  }

  const ordered = [];
  const usedEdges = new Set();
  const visited = new Set([startId]);
  const queue = [startId];

  while (queue.length > 0 && ordered.length < edges.length) {
    const id = queue.shift();
    const neighbors = [...(adjacency.get(id) ?? [])].sort((a, b) => {
      const pointA = byId.get(a.neighbor);
      const pointB = byId.get(b.neighbor);
      const distA = (pointA.x - cx) ** 2 + (pointA.y - cy) ** 2;
      const distB = (pointB.x - cx) ** 2 + (pointB.y - cy) ** 2;
      return distA - distB;
    });

    for (const { neighbor, edge } of neighbors) {
      if (usedEdges.has(edge.id)) continue;
      usedEdges.add(edge.id);
      ordered.push(edge);
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  for (const edge of edges) {
    if (!usedEdges.has(edge.id)) ordered.push(edge);
  }

  return ordered;
}

export function getNetworkEdgeStats(points, options = {}) {
  const edges = buildNetworkEdges(points, options);
  const degree = getDegrees(edges);
  const completeGraphCount = (points.length * (points.length - 1)) / 2;
  const maxObservedDegree = Math.max(0, ...[...degree.values()]);

  const uf = new UnionFind(points.map((point) => point.id));
  for (const edge of edges) {
    uf.union(edge.fromId, edge.toId);
  }

  const connected = points.every(
    (point, index, list) =>
      list.length <= 1 || list.every((other) => uf.connected(point.id, other.id))
  );

  return {
    edgeCount: edges.length,
    completeGraphCount,
    maxObservedDegree,
    connected
  };
}
