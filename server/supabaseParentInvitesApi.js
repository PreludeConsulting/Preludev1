import { z } from "zod";
import { readJsonBody, sendJson } from "./http.js";
import { enforceIpRateLimit } from "./lib/ipRateLimit.js";
import { buildAuthUrl, deliverParentInviteEmail } from "./lib/authEmail.js";
import { createSupabaseAdmin } from "./lib/supabasePasswordReset.js";

const parentInviteSendSchema = z.object({
  parentEmail: z.string().trim().email().max(255),
  studentName: z.string().trim().min(1).max(120).optional(),
  inviteToken: z.string().trim().min(8).max(200)
});

const INVITE_SEND_LIMIT = 10;
const INVITE_SEND_WINDOW_SECONDS = 60 * 60;

function getAccessToken(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
}

async function requireSupabaseUser(req, env = process.env) {
  const supabase = createSupabaseAdmin(env);
  if (!supabase) {
    const error = new Error("Supabase server credentials are not configured.");
    error.statusCode = 503;
    throw error;
  }

  const token = getAccessToken(req);
  if (!token) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error("Authentication required.");
    authError.statusCode = 401;
    throw authError;
  }

  return { supabase, user: data.user };
}

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

async function handleParentInviteSend(req, res, env = process.env) {
  const admin = createSupabaseAdmin(env);
  if (!admin) {
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

  const { user } = await requireSupabaseUser(req, env);
  const payload = parentInviteSendSchema.parse(await readJsonBody(req));

  // Only students should be able to send parent invites.
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if ((profile?.role || "").toLowerCase() !== "student") {
    return sendJson(res, 403, {
      error: "forbidden",
      message: "Only student accounts can invite a parent or guardian."
    });
  }

  const url = buildAuthUrl(
    req,
    `/register?${new URLSearchParams({ parentInvite: payload.inviteToken, role: "parent" }).toString()}`
  );

  const result = await deliverParentInviteEmail({
    to: normalizeEmail(payload.parentEmail),
    studentName: profile?.full_name || payload.studentName || "your student",
    url,
    req
  });

  return sendJson(res, 200, {
    message: "Invitation email sent.",
    emailSent: Boolean(result.delivered || result.logged)
  });
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

