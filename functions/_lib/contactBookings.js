import { bookContactCall, sendDueContactReminders } from "../../server/lib/contactBookings.js";
import { enforceIpRateLimit } from "../../server/lib/ipRateLimit.js";

const BOOK_CALL_LIMIT = 8;
const BOOK_CALL_WINDOW_SECONDS = 60 * 60;

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

function methodNotAllowed() {
  return json({ error: "method_not_allowed", message: "Method not allowed." }, 405, {
    Allow: "POST"
  });
}

function errorResponse(error) {
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

export async function handleContactBookCall(context) {
  if (context.request.method !== "POST") return methodNotAllowed();

  const env = envFromContext(context);
  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/contact/book-call",
    BOOK_CALL_LIMIT,
    BOOK_CALL_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    const headers = rateLimitError.retryAfterSeconds
      ? { "Retry-After": String(rateLimitError.retryAfterSeconds) }
      : {};
    return json(
      {
        error: rateLimitError.code,
        message: "Too many booking requests. Please wait a moment and try again."
      },
      rateLimitError.statusCode,
      headers
    );
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "validation_error", message: "Invalid request body." }, 400);
  }

  try {
    const result = await bookContactCall({ env, payload });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

function hasReminderSecret(context, env) {
  const configured = env.CONTACT_REMINDER_SECRET?.trim();
  if (!configured) return false;

  const authorization = context.request.headers.get("Authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = context.request.headers.get("x-contact-reminder-secret") || "";
  return bearer === configured || headerSecret.trim() === configured;
}

export async function handleContactSendReminders(context) {
  if (context.request.method !== "POST" && context.request.method !== "GET") {
    return json({ error: "method_not_allowed", message: "Method not allowed." }, 405, {
      Allow: "GET, POST"
    });
  }

  const env = envFromContext(context);
  if (!env.CONTACT_REMINDER_SECRET?.trim()) {
    return json(
      {
        error: "reminders_not_configured",
        message: "Set CONTACT_REMINDER_SECRET before enabling automated reminders."
      },
      503
    );
  }

  if (!hasReminderSecret(context, env)) {
    return json({ error: "unauthorized", message: "Authentication required." }, 401);
  }

  try {
    const result = await sendDueContactReminders({ env });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
