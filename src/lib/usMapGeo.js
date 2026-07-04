import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import nationTopology from "us-atlas/nation-10m.json";
import statesTopology from "us-atlas/states-10m.json";

/** Albers USA map canvas — matches projection fitSize. */
export const US_MAP_VIEWBOX = { width: 975, height: 610 };

const statesCollection = feature(statesTopology, statesTopology.objects.states);
const nationFeature = feature(nationTopology, nationTopology.objects.nation);

const projection = geoAlbersUsa().fitSize(
  [US_MAP_VIEWBOX.width, US_MAP_VIEWBOX.height],
  statesCollection
);

const pathGenerator = geoPath(projection);

/** Real US outer outline from us-atlas nation TopoJSON. */
export const US_NATION_PATH = pathGenerator(nationFeature) || "";

/** Real interior state borders from us-atlas states mesh. */
export const US_STATES_MESH_PATH =
  pathGenerator(mesh(statesTopology, statesTopology.objects.states, (a, b) => a !== b)) || "";

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

export { projection, pathGenerator };
