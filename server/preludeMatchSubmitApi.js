import { sendJson } from "./http.js";
import { requireSupabaseUser } from "./lib/supabaseRequestAuth.js";
import {
  GENERIC_RETRY,
  MAX_PRELUDE_MATCH_BODY_BYTES,
  processPreludeMatchSubmission
} from "./lib/preludeMatchSubmit.js";
import { withApiRateLimit } from "./lib/apiRateLimitMiddleware.js";

async function readRawJsonBody(req) {
  if (typeof req.body === "string") {
    return { rawText: req.body, payload: req.body ? JSON.parse(req.body) : {} };
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(req.body)) {
    const rawText = req.body.toString("utf8");
    return { rawText, payload: rawText ? JSON.parse(rawText) : {} };
  }
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    const rawText = JSON.stringify(req.body);
    return { rawText, payload: req.body };
  }

  const rawText = await new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding?.("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_PRELUDE_MATCH_BODY_BYTES) {
        reject(Object.assign(new Error("Payload too large"), { statusCode: 413, code: "payload_too_large" }));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
  return { rawText, payload: rawText ? JSON.parse(rawText) : {} };
}

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
      const { rawText, payload } = await readRawJsonBody(req);
      if (rawText.length > MAX_PRELUDE_MATCH_BODY_BYTES) {
        return sendJson(res, 413, { success: false, error: "Payload too large" });
      }

      const result = await processPreludeMatchSubmission({
        env,
        user: { id: user.id, email: user.email },
        payload
      });
      return sendJson(res, 200, result);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { success: false, error: "Invalid Prelude Match submission", code: "validation_error" });
      }
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
