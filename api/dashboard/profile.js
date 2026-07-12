import legacyHandler from "../../server/dashboardApi.js";
import { createSupabaseDashboardApiMiddleware } from "../../server/supabaseDashboardApi.js";

const supabaseMiddleware = createSupabaseDashboardApiMiddleware();

export default function handler(req, res) {
  return supabaseMiddleware(req, res, () => legacyHandler(req, res));
}
