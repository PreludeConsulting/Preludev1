import { UNIVERSITIES } from "./universities.js";

/** Continental US bounds for SVG projection. */
export const US_MAP_BOUNDS = {
  minLon: -125,
  maxLon: -66.5,
  minLat: 24.5,
  maxLat: 49.5
};

export const US_MAP_VIEWBOX = { width: 960, height: 560 };

/** Approximate campus coordinates for the curated 25-school network list. */
export const UNIVERSITY_GEO = {
  stanford: { lat: 37.4275, lon: -122.1697 },
  harvard: { lat: 42.377, lon: -71.1167 },
  mit: { lat: 42.3601, lon: -71.0942 },
  upenn: { lat: 39.9522, lon: -75.1932 },
  princeton: { lat: 40.3431, lon: -74.6551 },
  yale: { lat: 41.3163, lon: -72.9223 },
  columbia: { lat: 40.8075, lon: -73.9626 },
  duke: { lat: 36.0014, lon: -78.9382 },
  northwestern: { lat: 42.0565, lon: -87.6753 },
  "johns-hopkins": { lat: 39.3299, lon: -76.6205 },
  brown: { lat: 41.8268, lon: -71.4025 },
  cornell: { lat: 42.4534, lon: -76.4735 },
  dartmouth: { lat: 43.7044, lon: -72.2887 },
  ucla: { lat: 34.0689, lon: -118.4452 },
  "uc-berkeley": { lat: 37.8719, lon: -122.2585 },
  uchicago: { lat: 41.7886, lon: -87.5987 },
  vanderbilt: { lat: 36.1447, lon: -86.8027 },
  rice: { lat: 29.7174, lon: -95.4018 },
  "notre-dame": { lat: 41.7052, lon: -86.2354 },
  georgetown: { lat: 38.9076, lon: -77.0723 },
  cmu: { lat: 40.4432, lon: -79.9436 },
  nyu: { lat: 40.7295, lon: -73.9965 },
  usc: { lat: 34.0224, lon: -118.2851 },
  michigan: { lat: 42.278, lon: -83.7382 },
  unc: { lat: 35.9049, lon: -79.0469 }
};

/** Network hub — geographic center of the continental US. */
export const NETWORK_HUB = { lat: 39.8283, lon: -98.5795 };

/**
 * Project lat/lon into SVG viewBox coordinates.
 * @param {number} lat
 * @param {number} lon
 * @param {typeof US_MAP_VIEWBOX} [viewBox]
 * @param {typeof US_MAP_BOUNDS} [bounds]
 */
export function projectLatLon(
  lat,
  lon,
  viewBox = US_MAP_VIEWBOX,
  bounds = US_MAP_BOUNDS
) {
  const x =
    ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * viewBox.width;
  const y =
    ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * viewBox.height;
  return { x, y };
}

/** Curated schools with projected map coordinates. */
export function getNetworkMapPoints() {
  return UNIVERSITIES.map((school) => {
    const geo = UNIVERSITY_GEO[school.id];
    if (!geo) return null;
    const point = projectLatLon(geo.lat, geo.lon);
    return { id: school.id, name: school.shortName, ...point };
  }).filter(Boolean);
}

/** Rough continental US coastline for the SVG landmass (lon/lat, clockwise). */
const US_COAST_LATLON = [
  [49.0, -124.7],
  [48.4, -124.6],
  [46.2, -124.1],
  [43.4, -124.5],
  [40.4, -124.4],
  [37.8, -122.5],
  [34.0, -120.5],
  [32.5, -117.1],
  [32.7, -114.7],
  [31.3, -108.2],
  [29.3, -103.0],
  [26.0, -97.2],
  [25.9, -91.0],
  [29.0, -89.0],
  [30.2, -87.5],
  [30.4, -81.4],
  [27.9, -82.4],
  [25.1, -80.2],
  [27.5, -79.8],
  [32.0, -80.8],
  [34.7, -76.0],
  [36.9, -75.7],
  [39.0, -74.9],
  [41.0, -71.9],
  [43.1, -70.7],
  [44.8, -67.0],
  [47.5, -69.2],
  [47.3, -84.3],
  [46.7, -92.0],
  [48.2, -95.0],
  [49.0, -95.2],
  [49.0, -124.7]
];

function buildUSOutlinePath() {
  const points = US_COAST_LATLON.map(([lat, lon]) => projectLatLon(lat, lon));
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ")
    .concat(" Z");
}

/** Simplified continental US outline path tuned to the projection bounds. */
export const US_OUTLINE_PATH = buildUSOutlinePath();
