import { z } from "zod";
import { SIGNUP_VERIFICATION_GENERIC_MESSAGE } from "../shared/signupVerificationConstants.js";
import { readJsonBody, sendJson } from "./http.js";
import { enforceIpRateLimit } from "./lib/ipRateLimit.js";
import { createSupabaseAdmin } from "./lib/supabasePasswordReset.js";
import { sendSupabaseSignupVerificationEmail } from "./lib/supabaseSignupVerification.js";

const sendSignupVerificationSchema = z.object({
  email: z.string().trim().email().max(255),
  captchaToken: z.string().trim().min(1).optional()
});

const VERIFICATION_REQUEST_LIMIT = 5;
const VERIFICATION_REQUEST_WINDOW_SECONDS = 60 * 60;

function isSupabaseSignupVerificationConfigured(env = process.env) {
  return Boolean(createSupabaseAdmin(env));
}

async function handleSendSignupVerification(req, res, env = process.env) {
  if (!isSupabaseSignupVerificationConfigured(env)) {
    return sendJson(res, 503, {
      error: "signup_verification_unavailable",
      message: "Email verification is not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    });
  }

  const rateLimitError = enforceIpRateLimit(
    req,
    "/api/auth/send-signup-verification",
    VERIFICATION_REQUEST_LIMIT,
    VERIFICATION_REQUEST_WINDOW_SECONDS,
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

  const payload = sendSignupVerificationSchema.parse(await readJsonBody(req));
  const delivery = await sendSupabaseSignupVerificationEmail({
    email: payload.email,
    req,
    env
  });

  if (!delivery.delivered && !delivery.logged && !delivery.accountUnknown && env.NODE_ENV === "production") {
    console.error("[prelude-auth] signup_verification_delivery_failed", {
      email: payload.email,
      reason: delivery.reason || "unknown"
    });
    return sendJson(res, 503, {
      error: "email_delivery_failed",
      message: "We couldn't send a verification email right now. Please try again in a moment."
    });
  }

  return sendJson(res, 200, {
    message: SIGNUP_VERIFICATION_GENERIC_MESSAGE,
    emailSent: Boolean(delivery.delivered)
  });
}

export function createSupabaseSignupVerificationMiddleware(env = process.env) {
  return async function supabaseSignupVerificationMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/api/auth/send-signup-verification" || req.method !== "POST") {
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
      return await handleSendSignupVerification(req, res, env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      }
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-supabase-signup-verification]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createSupabaseSignupVerificationMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
