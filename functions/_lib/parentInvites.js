import { sendParentInviteEmail } from "../../server/lib/parentInvites.js";
import { enforceIpRateLimit } from "../../server/lib/ipRateLimit.js";
import { createSupabaseAdmin } from "../../server/lib/supabasePasswordReset.js";

const INVITE_SEND_LIMIT = 10;
const INVITE_SEND_WINDOW_SECONDS = 60 * 60;

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
      authorization: request.headers.get("Authorization") || "",
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

export async function handleParentInviteSend(context) {
  const env = envFromContext(context);
  if (!createSupabaseAdmin(env)) {
    return json(
      {
        error: "parent_invites_unavailable",
        message: "Parent invites are not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
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

  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/parent-invites/send",
    INVITE_SEND_LIMIT,
    INVITE_SEND_WINDOW_SECONDS,
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
    const result = await sendParentInviteEmail({
      req: requestFromContext(context),
      env,
      payload
    });
    return json(result);
  } catch (error) {
    if (error?.name === "ZodError") {
      return json({ error: "validation_error", issues: error.issues }, 400);
    }
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
