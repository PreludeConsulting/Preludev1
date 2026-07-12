import { handleDashboard } from "../../_lib/dashboard.js";

export function onRequest(context) {
  return handleDashboard(context, "profile");
}
