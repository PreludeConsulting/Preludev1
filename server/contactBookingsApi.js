import { z } from "zod";
import { readJsonBody, sendJson } from "./http.js";
import { bookContactCall, getContactAvailability } from "./lib/contactBookings.js";
import { enforceIpRateLimit } from "./lib/ipRateLimit.js";
import { withApiRateLimit } from "./lib/apiRateLimitMiddleware.js";

function errorPayload(error, env) {
  if (error instanceof z.ZodError) {
    return { status: 400, body: { error: "validation_error", message: "Please check the required fields." } };
  }
  const status = error.statusCode || 500;
  const body = {
    error: error.code || (status >= 500 ? "server_error" : "request_failed"),
    message: error.message || "Request failed."
  };
  if (env.NODE_ENV !== "production" && status >= 500) {
    body.debugMessage = error.cause?.message || error.message;
  }
  return { status, body };
}

export function createContactBookingsMiddleware(env = process.env) {
  return async function contactBookingsMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/api/contact/availability") {
      if (req.method === "OPTIONS") return sendJson(res, 204, {});
      if (req.method !== "GET") return sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET" });
      const rateLimitError = enforceIpRateLimit(req, pathname, 60, 60 * 60, env);
      if (rateLimitError) {
        return sendJson(
          res,
          429,
          { error: "rate_limited", message: "Too many availability checks. Please wait a moment and try again." },
          { "Retry-After": String(rateLimitError.retryAfterSeconds) }
        );
      }
      try {
        return sendJson(res, 200, await getContactAvailability({ env }));
      } catch (error) {
        const { status, body } = errorPayload(error, env);
        return sendJson(res, status, body);
      }
    }

    if (pathname !== "/api/contact/book-call") return next();
    if (req.method === "OPTIONS") return sendJson(res, 204, {});
    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });

    const rateLimitError = enforceIpRateLimit(req, pathname, 8, 60 * 60, env);
    if (rateLimitError) {
      return sendJson(
        res,
        429,
        { error: "rate_limited", message: "Too many booking requests. Please wait a moment and try again." },
        { "Retry-After": String(rateLimitError.retryAfterSeconds) }
      );
    }

    try {
      const payload = req.body && typeof req.body === "object" ? req.body : await readJsonBody(req);
      return sendJson(res, 200, await bookContactCall({ env, payload }));
    } catch (error) {
      const { status, body } = errorPayload(error, env);
      return sendJson(res, status, body);
    }
  };
}

const middleware = createContactBookingsMiddleware();
function contactBookingsHandler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}

export default withApiRateLimit(contactBookingsHandler);
