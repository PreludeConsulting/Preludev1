import { projectLatLon } from "./universityGeo.js";

/** Simplified interior state borders — decorative schematic lines only. */
const STATE_LATLON_PATHS = [
  [[49, -124], [49, -104], [37, -104], [37, -114], [32, -114], [32, -117], [34, -120], [42, -124], [49, -124]],
  [[49, -104], [49, -90], [43, -90], [43, -96], [40, -96], [37, -102], [37, -104], [49, -104]],
  [[49, -90], [49, -82], [42, -82], [42, -87], [41, -87], [41, -90], [43, -96], [43, -90], [49, -90]],
  [[43, -79], [43, -71], [41, -71], [40, -74], [39, -75], [37, -76], [36, -76], [36, -79], [39, -79], [43, -79]],
  [[37, -89], [37, -76], [32, -84], [30, -84], [30, -88], [31, -89], [37, -89]],
  [[36, -103], [36, -94], [33, -94], [31, -94], [31, -103], [36, -103]],
  [[37, -114], [37, -109], [31, -109], [31, -114], [37, -114]],
  [[49, -82], [49, -66.5], [45, -67], [43, -70], [42, -71], [42, -82], [49, -82]],
  [[45, -124], [45, -104], [41, -104], [41, -111], [45, -124]],
  [[41, -87], [41, -80], [39, -80], [38, -82], [37, -82], [37, -89], [41, -87]]
];

function pathFromLatLon(coords) {
  return coords
    .map((pair, index) => {
      const { x, y } = projectLatLon(pair[0], pair[1]);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ")
    .concat(" Z");
}

/** Decorative state-border paths projected to the map viewBox. */
export const US_STATE_OUTLINE_PATHS = STATE_LATLON_PATHS.map(pathFromLatLon);
