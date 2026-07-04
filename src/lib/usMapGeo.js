import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import nationTopology from "us-atlas/nation-10m.json";
import statesTopology from "us-atlas/states-10m.json";

const MAP_PADDING = 10;
const FIT_BOX = { width: 975, height: 610 };

const statesCollection = feature(statesTopology, statesTopology.objects.states);
const nationFeature = feature(nationTopology, nationTopology.objects.nation);
const statesMesh = mesh(statesTopology, statesTopology.objects.states, (a, b) => a !== b);

const projection = geoAlbersUsa().fitExtent(
  [
    [MAP_PADDING, MAP_PADDING],
    [FIT_BOX.width - MAP_PADDING, FIT_BOX.height - MAP_PADDING]
  ],
  statesCollection
);

const pathGenerator = geoPath(projection);

function unionBounds(a, b) {
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]
  ];
}

const [[rawX0, rawY0], [rawX1, rawY1]] = unionBounds(
  pathGenerator.bounds(statesCollection),
  unionBounds(pathGenerator.bounds(nationFeature), pathGenerator.bounds(statesMesh))
);

/** ViewBox derived from projected geography bounds — not a hardcoded guess. */
export const US_MAP_VIEWBOX = {
  x: rawX0 - MAP_PADDING,
  y: rawY0 - MAP_PADDING,
  width: rawX1 - rawX0 + MAP_PADDING * 2,
  height: rawY1 - rawY0 + MAP_PADDING * 2
};

export const US_MAP_VIEWBOX_ATTR = `${US_MAP_VIEWBOX.x} ${US_MAP_VIEWBOX.y} ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`;

export const US_MAP_ASPECT_RATIO = US_MAP_VIEWBOX.width / US_MAP_VIEWBOX.height;

/** Real US outer outline from us-atlas nation TopoJSON. */
export const US_NATION_PATH = pathGenerator(nationFeature) || "";

/** Real interior state borders from us-atlas states mesh. */
export const US_STATES_MESH_PATH = pathGenerator(statesMesh) || "";

/** Individual state paths for clip / land fill. */
export const US_STATE_PATHS = statesCollection.features
  .map((stateFeature) => ({
    id: stateFeature.id,
    name: stateFeature.properties?.name || "",
    d: pathGenerator(stateFeature) || ""
  }))
  .filter((state) => state.d);

/**
 * Project WGS84 coordinates through geoAlbersUsa().
 * @param {number} lon
 * @param {number} lat
 * @returns {{ x: number, y: number } | null}
 */
export function projectGeoPoint(lon, lat) {
  const projected = projection([lon, lat]);
  if (!projected) return null;
  const [x, y] = projected;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** True when a projected point lies inside the computed map viewBox. */
export function isPointInMapViewBox(x, y) {
  return (
    x >= US_MAP_VIEWBOX.x &&
    x <= US_MAP_VIEWBOX.x + US_MAP_VIEWBOX.width &&
    y >= US_MAP_VIEWBOX.y &&
    y <= US_MAP_VIEWBOX.y + US_MAP_VIEWBOX.height
  );
}

export { projection, pathGenerator };
