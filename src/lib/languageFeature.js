import { PARENT_DASHBOARD_BASE } from "./dashboardRoutes.js";

/** Routes where visitors can choose a site language (marketing home + parent dashboard). */
export function isLanguageFeatureEnabled(pathname) {
  if (!pathname || pathname === "/") return true;
  if (pathname.startsWith(`${PARENT_DASHBOARD_BASE}/`) || pathname === PARENT_DASHBOARD_BASE) {
    return true;
  }
  return false;
}
