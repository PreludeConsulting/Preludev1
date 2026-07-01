import {
  createSupabaseAdmin,
  resolvePasswordResetEmail,
  sendSupabasePasswordResetEmail
} from "../../server/lib/supabasePasswordReset.js";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "../../shared/passwordResetConstants.js";
import { enforceIpRateLimit } from "../../server/lib/ipRateLimit.js";

const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_SECONDS = 60 * 60;

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function requestFromContext(context) {
  const request = context.request;
  const url = new URL(request.url);
  return {
    headers: {
      host: url.host,
      "x-forwarded-host": request.headers.get("x-forwarded-host") || url.host,
      "x-forwarded-proto": request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")
    }
  };
}

function envFromContext(context) {
  return {
    ...context.env,
    NODE_ENV: context.env?.NODE_ENV || "production"
  };
}

export async function handleRequestPasswordReset(context) {
  const env = envFromContext(context);
  if (!createSupabaseAdmin(env)) {
    return json(
      {
        error: "password_reset_unavailable",
        message: "Password reset is not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      },
      503
    );
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "validation_error", message: "Invalid request body." }, 400);
  }

  const email = String(payload?.email || "").trim();
  if (!email || !email.includes("@")) {
    return json({ error: "validation_error", message: "Enter a valid email address." }, 400);
  }

  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/auth/request-password-reset",
    RESET_REQUEST_LIMIT,
    RESET_REQUEST_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    const headers = rateLimitError.retryAfterSeconds
      ? { "Retry-After": String(rateLimitError.retryAfterSeconds) }
      : {};
    return json(
      {
        error: rateLimitError.code,
        message: rateLimitError.message
      },
      rateLimitError.statusCode,
      headers
    );
  }

  try {
    const accessToken = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
    const targetEmail = await resolvePasswordResetEmail({
      requestedEmail: email,
      accessToken,
      env
    });
    const delivery = await sendSupabasePasswordResetEmail({
      email: targetEmail,
      req: requestFromContext(context),
      env
    });

    if (!delivery.delivered && !delivery.logged && !delivery.accountUnknown) {
      return json(
        {
          error: "email_delivery_failed",
          message: "We couldn't send a password reset email right now. Please try again in a moment."
        },
        503
      );
    }

    return json({
      message: PASSWORD_RESET_GENERIC_MESSAGE,
      emailSent: Boolean(delivery.delivered)
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(
      {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      },
      statusCode
    );
  }
}
