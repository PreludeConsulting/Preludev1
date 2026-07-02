import { z } from "zod";
import { readJsonBody, sendJson } from "./http.js";
import { enforceIpRateLimit } from "./lib/ipRateLimit.js";
import { createSupabaseAdmin } from "./lib/supabasePasswordReset.js";
import { sendParentInviteEmail } from "./lib/parentInvites.js";

const INVITE_SEND_LIMIT = 10;
const INVITE_SEND_WINDOW_SECONDS = 60 * 60;

async function handleParentInviteSend(req, res, env = process.env) {
  if (!createSupabaseAdmin(env)) {
    return sendJson(res, 503, {
      error: "parent_invites_unavailable",
      message: "Parent invites are not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    });
  }

  const rateLimitError = enforceIpRateLimit(
    req,
    "/api/parent-invites/send",
    INVITE_SEND_LIMIT,
    INVITE_SEND_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    return sendJson(
      res,
      rateLimitError.statusCode,
      { error: rateLimitError.code, message: rateLimitError.message },
      rateLimitError.retryAfterSeconds ? { "Retry-After": String(rateLimitError.retryAfterSeconds) } : undefined
    );
  }

  const payload = await readJsonBody(req);
  const result = await sendParentInviteEmail({ req, env, payload });
  return sendJson(res, 200, result);
}

export function createSupabaseParentInvitesMiddleware(env = process.env) {
  return async function supabaseParentInvitesMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/api/parent-invites/send" || req.method !== "POST") {
      return next();
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    try {
      return await handleParentInviteSend(req, res, env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      }
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-supabase-parent-invites]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createSupabaseParentInvitesMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
