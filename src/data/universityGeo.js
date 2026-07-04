import { UNIVERSITIES } from "./universities.js";
import {
  US_MAP_VIEWBOX,
  US_MAP_VIEWBOX_ATTR,
  US_MAP_ASPECT_RATIO,
  US_NATION_PATH,
  US_STATE_PATHS,
  US_STATES_MESH_PATH,
  projectGeoPoint
} from "../lib/usMapGeo.js";

export {
  US_MAP_VIEWBOX,
  US_MAP_VIEWBOX_ATTR,
  US_MAP_ASPECT_RATIO,
  US_NATION_PATH,
  US_NATION_PATH as US_OUTLINE_PATH,
  US_STATES_MESH_PATH,
  US_STATE_PATHS
};

/** Real campus coordinates for the curated 25-school network list. */
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

/** Cross-country showcase arcs merged before the per-node degree cap. */
export const NETWORK_SHOWCASE_CONNECTIONS = [
  ["stanford", "harvard"],
  ["ucla", "nyu"],
  ["uc-berkeley", "mit"],
  ["usc", "georgetown"],
  ["rice", "northwestern"],
  ["duke", "ucla"],
  ["vanderbilt", "stanford"],
  ["michigan", "columbia"]
];

/** @deprecated Kept for legacy tests — use projectGeoPoint instead. */
export const NETWORK_HUB = { lat: 39.8283, lon: -98.5795 };

/** @deprecated Use projectGeoPoint — Albers USA replaces linear bounds projection. */
export function projectLatLon(lat, lon) {
  const point = projectGeoPoint(lon, lat);
  if (!point) return { x: 0, y: 0 };
  return point;
}

/**
 * Curated schools projected through geoAlbersUsa().
 * @returns {Array<{ id: string, name: string, lat: number, lon: number, x: number, y: number }>}
 */
export function getNetworkMapPoints() {
  return UNIVERSITIES.map((school) => {
    const geo = UNIVERSITY_GEO[school.id];
    if (!geo) return null;
    const point = projectGeoPoint(geo.lon, geo.lat);
    if (!point) return null;
    return {
      id: school.id,
      name: school.shortName,
      lat: geo.lat,
      lon: geo.lon,
      ...point
    };
  }).filter(Boolean);
}

/** Coordinate report for verification — all 25 schools with lat/lon and projected x/y. */
export function getUniversityCoordinateReport() {
  return getNetworkMapPoints().map((point) => ({
    id: point.id,
    name: point.name,
    lat: point.lat,
    lon: point.lon,
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2))
  }));
}
