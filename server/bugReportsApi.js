import { z } from "zod";
import { requireAuth } from "./authApi.js";
import { readJsonBody, sendJson } from "./http.js";
import { sendBugReport } from "./lib/bugReports.js";
import { enforceIpRateLimit } from "./lib/ipRateLimit.js";
import { requireSupabaseUser } from "./lib/supabaseRequestAuth.js";

async function optionalVerifiedAccount(req) {
  try {
    const { user } = await requireAuth(req);
    return { name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "", email: user.email || "", role: user.role || "", userId: user.id || "" };
  } catch {}
  try {
    const { supabase, user } = await requireSupabaseUser(req);
    const { data: profile } = await supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle();
    return { name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "", email: user.email || "", role: profile?.role || user.user_metadata?.role || "", userId: user.id };
  } catch {
    return null;
  }
}

export function createBugReportsMiddleware(env = process.env) {
  return async function bugReportsMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/api/support/bug-report") return next();
    if (req.method === "OPTIONS") return sendJson(res, 204, {});
    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    const rateLimitError = enforceIpRateLimit(req, url.pathname, 5, 60 * 60, env);
    if (rateLimitError) return sendJson(res, 429, { error: "rate_limited", message: "Too many reports. Please wait and try again." }, { "Retry-After": String(rateLimitError.retryAfterSeconds) });
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : await readJsonBody(req);
      const result = await sendBugReport({ env, payload, verifiedAccount: await optionalVerifiedAccount(req) });
      return sendJson(res, 200, result);
    } catch (error) {
      if (error instanceof z.ZodError) return sendJson(res, 400, { error: "validation_error", message: "Please check the required fields." });
      if ((error.statusCode || 500) >= 500) console.error("[prelude-bug-report]", {
        code: error.code,
        message: error.message,
        details: error.details
      });
      const response = { error: error.code || "server_error", message: "Something went wrong sending your report. Please try again." };
      if (env.NODE_ENV !== "production") response.debugMessage = error.details?.providerMessage || error.message;
      return sendJson(res, error.statusCode || 500, response);
    }
  };
}

const middleware = createBugReportsMiddleware();
export default function handler(req, res) { return middleware(req, res, () => sendJson(res, 404, { error: "not_found" })); }
