/**
 * @typedef {{ id: string, x: number, y: number, r: number, opacity: number }} StardustPoint
 */

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Seeded stardust field for the US landmass (clip in SVG).
 * @param {{ width: number, height: number, count?: number, seed?: number, padding?: number }} opts
 * @returns {StardustPoint[]}
 */
export function buildStardustPoints({
  width,
  height,
  count = 900,
  seed = 42,
  padding = 24
}) {
  const rng = createSeededRandom(seed);
  /** @type {StardustPoint[]} */
  const points = [];

  for (let i = 0; i < count; i += 1) {
    points.push({
      id: `star-${i}`,
      x: padding + rng() * (width - padding * 2),
      y: padding + rng() * (height - padding * 2),
      r: 0.3 + rng() * 0.65,
      opacity: 0.12 + rng() * 0.38
    });
  }

  return points;
}
