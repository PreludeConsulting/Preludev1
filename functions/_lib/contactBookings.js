import { bookContactCall, getContactAvailability } from "../../server/lib/contactBookings.js";
import { enforceIpRateLimit } from "../../server/lib/ipRateLimit.js";

const BOOK_CALL_LIMIT = 8;
const BOOK_CALL_WINDOW_SECONDS = 60 * 60;
const AVAILABILITY_LIMIT = 60;
const AVAILABILITY_WINDOW_SECONDS = 60 * 60;

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  responseHeaders.set("Cache-Control", "no-store");
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

function methodNotAllowed(allow) {
  return json({ error: "method_not_allowed", message: "Method not allowed." }, 405, {
    Allow: allow
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

function rateLimitResponse(rateLimitError, message) {
  const headers = rateLimitError.retryAfterSeconds
    ? { "Retry-After": String(rateLimitError.retryAfterSeconds) }
    : {};
  return json(
    {
      error: rateLimitError.code,
      message
    },
    rateLimitError.statusCode,
    headers
  );
}

export async function handleContactAvailability(context) {
  if (context.request.method === "OPTIONS") return json({}, 204);
  if (context.request.method !== "GET") return methodNotAllowed("GET");

  const env = envFromContext(context);
  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/contact/availability",
    AVAILABILITY_LIMIT,
    AVAILABILITY_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    return rateLimitResponse(rateLimitError, "Too many availability checks. Please wait a moment and try again.");
  }

  try {
    const result = await getContactAvailability({ env });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleContactBookCall(context) {
  if (context.request.method !== "POST") return methodNotAllowed("POST");

  const env = envFromContext(context);
  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/contact/book-call",
    BOOK_CALL_LIMIT,
    BOOK_CALL_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    return rateLimitResponse(rateLimitError, "Too many booking requests. Please wait a moment and try again.");
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
