import { sendSupabaseSignupVerificationEmail } from "../../server/lib/supabaseSignupVerification.js";
import { SIGNUP_VERIFICATION_GENERIC_MESSAGE } from "../../shared/signupVerificationConstants.js";
import { enforceIpRateLimit } from "../../server/lib/ipRateLimit.js";
import { createSupabaseAdmin } from "../../server/lib/supabasePasswordReset.js";

const VERIFICATION_REQUEST_LIMIT = 5;
const VERIFICATION_REQUEST_WINDOW_SECONDS = 60 * 60;

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function requestFromContext(context) {
  const request = context.request;
  const url = new URL(request.url);
  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "";
  return {
    headers: {
      host: url.host,
      "x-forwarded-host": request.headers.get("x-forwarded-host") || url.host,
      "x-forwarded-proto": request.headers.get("x-forwarded-proto") || url.protocol.replace(":", ""),
      "x-forwarded-for": clientIp
    }
  };
}

function envFromContext(context) {
  return {
    ...context.env,
    NODE_ENV: context.env?.NODE_ENV || "production"
  };
}

export async function handleSendSignupVerification(context) {
  const env = envFromContext(context);
  if (!createSupabaseAdmin(env)) {
    return json(
      {
        error: "signup_verification_unavailable",
        message: "Email verification is not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
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
    "/api/auth/send-signup-verification",
    VERIFICATION_REQUEST_LIMIT,
    VERIFICATION_REQUEST_WINDOW_SECONDS,
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
    const delivery = await sendSupabaseSignupVerificationEmail({
      email,
      req: requestFromContext(context),
      env
    });

    if (!delivery.delivered && !delivery.logged && !delivery.accountUnknown) {
      return json(
        {
          error: "email_delivery_failed",
          message: "We couldn't send a verification email right now. Please try again in a moment."
        },
        503
      );
    }

    return json({
      message: SIGNUP_VERIFICATION_GENERIC_MESSAGE,
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
