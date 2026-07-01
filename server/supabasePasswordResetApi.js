import { z } from "zod";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "../shared/passwordResetConstants.js";
import { readJsonBody, sendJson } from "./http.js";
import { enforceIpRateLimit } from "./lib/ipRateLimit.js";
import {
  createSupabaseAdmin,
  resolvePasswordResetEmail,
  sendSupabasePasswordResetEmail
} from "./lib/supabasePasswordReset.js";

const requestPasswordResetSchema = z.object({
  email: z.string().trim().email().max(255),
  captchaToken: z.string().trim().min(1).optional()
});

const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_SECONDS = 60 * 60;

function getAccessToken(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
}

function isSupabasePasswordResetConfigured(env = process.env) {
  return Boolean(createSupabaseAdmin(env));
}

async function handleRequestPasswordReset(req, res, env = process.env) {
  if (!isSupabasePasswordResetConfigured(env)) {
    return sendJson(res, 503, {
      error: "password_reset_unavailable",
      message: "Password reset is not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    });
  }

  const rateLimitError = enforceIpRateLimit(
    req,
    "/api/auth/request-password-reset",
    RESET_REQUEST_LIMIT,
    RESET_REQUEST_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    return sendJson(
      res,
      rateLimitError.statusCode,
      {
        error: rateLimitError.code,
        message: rateLimitError.message
      },
      rateLimitError.retryAfterSeconds
        ? { "Retry-After": String(rateLimitError.retryAfterSeconds) }
        : undefined
    );
  }

  const payload = requestPasswordResetSchema.parse(await readJsonBody(req));
  const accessToken = getAccessToken(req);
  const targetEmail = await resolvePasswordResetEmail({
    requestedEmail: payload.email,
    accessToken,
    env
  });

  const delivery = await sendSupabasePasswordResetEmail({
    email: targetEmail,
    req,
    env
  });

  if (!delivery.delivered && !delivery.logged && !delivery.accountUnknown && env.NODE_ENV === "production") {
    console.error("[prelude-auth] password_reset_delivery_failed", {
      email: targetEmail,
      reason: delivery.reason || "unknown"
    });
    return sendJson(res, 503, {
      error: "email_delivery_failed",
      message: "We couldn't send a password reset email right now. Please try again in a moment."
    });
  }

  return sendJson(res, 200, {
    message: PASSWORD_RESET_GENERIC_MESSAGE,
    emailSent: Boolean(delivery.delivered)
  });
}

export function createSupabasePasswordResetMiddleware(env = process.env) {
  return async function supabasePasswordResetMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/api/auth/request-password-reset" || req.method !== "POST") {
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
      return await handleRequestPasswordReset(req, res, env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      }
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-supabase-password-reset]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createSupabasePasswordResetMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
