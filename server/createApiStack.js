import { createAuthApiMiddleware, requireAuth } from "./authApi.js";
import { createBillingApiMiddleware } from "./billingApi.js";
import { createChatApiMiddleware } from "./chatApi.js";
import { createDatasetsApiMiddleware } from "./datasetsApi.js";
import { createDashboardApiMiddleware } from "./dashboardApi.js";

/** Shared Prelude API middleware stack (auth → dashboard → billing → datasets → chat). */
export function createPreludeApiStack(env = process.env) {
  return [
    createAuthApiMiddleware(env),
    createDashboardApiMiddleware(async (req) => {
      try {
        const auth = await requireAuth(req);
        return auth;
      } catch {
        return null;
      }
    }),
    createBillingApiMiddleware(),
    createDatasetsApiMiddleware(),
    createChatApiMiddleware(env)
  ];
}
