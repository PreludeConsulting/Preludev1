import { readJsonBody, sendJson } from "./http.js";
import { requireSupabaseUser } from "./lib/supabaseRequestAuth.js";
import {
  GENERIC_RETRY,
  MAX_PRELUDE_MATCH_BODY_BYTES,
  processPreludeMatchSubmission
} from "./lib/preludeMatchSubmit.js";
import { withApiRateLimit } from "./lib/apiRateLimitMiddleware.js";

export function createPreludeMatchSubmitMiddleware(env = process.env) {
  return async function preludeMatchSubmitMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/api/prelude-match/submit") return next();
    if (req.method === "OPTIONS") return sendJson(res, 204, {});
    if (req.method !== "POST") {
      return sendJson(res, 405, { success: false, error: "Method not allowed" }, { Allow: "POST" });
    }

    try {
      const contentLength = Number(req.headers["content-length"] || 0);
      if (contentLength > MAX_PRELUDE_MATCH_BODY_BYTES) {
        return sendJson(res, 413, { success: false, error: "Payload too large" });
      }

      const { user } = await requireSupabaseUser(req);
      const payload =
        req.body && typeof req.body === "object" ? req.body : await readJsonBody(req);

      const result = await processPreludeMatchSubmission({
        env,
        user: { id: user.id, email: user.email },
        payload
      });
      return sendJson(res, 200, result);
    } catch (error) {
      const status = Number(error?.statusCode || error?.status) || 500;
      if (status >= 500) {
        console.error("[prelude-match-submit]", {
          code: error?.code,
          message: error?.message
        });
      }
      return sendJson(res, status, {
        success: false,
        error: status >= 500 && error?.code !== "email_not_configured" && error?.code !== "email_domain"
          ? GENERIC_RETRY
          : error?.message || GENERIC_RETRY,
        code: error?.code || "server_error"
      });
    }
  };
}

const middleware = createPreludeMatchSubmitMiddleware();
function preludeMatchSubmitHandler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}

export default withApiRateLimit(preludeMatchSubmitHandler);
