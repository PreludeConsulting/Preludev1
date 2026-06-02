import { createAuthApiMiddleware } from "./authApi.js";
import { createBillingApiMiddleware } from "./billingApi.js";
import { createChatApiMiddleware } from "./chatApi.js";
import { createDatasetsApiMiddleware } from "./datasetsApi.js";

/** Shared Prelude API middleware stack (auth → billing → datasets → chat). */
export function createPreludeApiStack(env = process.env) {
  return [
    createAuthApiMiddleware(env),
    createBillingApiMiddleware(),
    createDatasetsApiMiddleware(),
    createChatApiMiddleware(env)
  ];
}
