import legacyHandler from "../../server/dashboardApi.js";
import { createSupabaseDashboardApiMiddleware } from "../../server/supabaseDashboardApi.js";
import { withApiRateLimit } from "../../server/lib/apiRateLimitMiddleware.js";

const supabaseMiddleware = createSupabaseDashboardApiMiddleware();

function handler(req, res) {
  return supabaseMiddleware(req, res, () => legacyHandler(req, res));
}

export default withApiRateLimit(handler);
