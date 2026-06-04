/**
 * App routing paths aligned with vite.config.js `base` (e.g. /Preludev1/).
 * Use React Router <Link to="..."> / navigate() for in-app navigation (no prefix).
 * Use appPath() for <a href> and window.location when a full URL path is required.
 */

export const ROUTER_BASENAME =
  import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "") || "/Preludev1";

/** True for in-app routes like /dashboard (not hash or external URLs). */
export function isAppRoute(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

/** Full browser path including Vite base — for anchors and hard redirects. */
export function appPath(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return ROUTER_BASENAME ? `${ROUTER_BASENAME}${normalized}` : normalized;
}
