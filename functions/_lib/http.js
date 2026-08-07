/**
 * Shared Fetch-native helpers for Cloudflare Pages Functions (Workers runtime).
 * Extracted from dashboard.js so meetings/integrations/activities/students routes
 * can reuse the same auth, REST, JSON, CORS, and error-mapping conventions.
 */

const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key";
const DEFAULT_ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";

export function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  if (!responseHeaders.has("Cache-Control")) responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

export function config(context) {
  return {
    url: context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL || "",
    key: context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    serviceRoleKey: context.env?.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

export function bearerToken(context) {
  return (context.request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

export function runtimeFetch(context) {
  return context.fetch || fetch;
}

export function httpError(message, statusCode = 500, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  if (code) error.code = code;
  return error;
}

export async function requireUser(context) {
  const { url, key } = config(context);
  const token = bearerToken(context);
  if (!token) throw httpError("Authentication required.", 401, "unauthenticated");
  if (!url || !key) throw httpError("Supabase is not configured.", 503, "service_unavailable");
  const response = await runtimeFetch(context)(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` }
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) throw httpError("Authentication required.", 401, "unauthenticated");
  return { user, token };
}

/** Same as config(), named for readability at call sites that need the service-role key. */
export function supabaseConfig(context) {
  return config(context);
}

/**
 * Runs a handler after resolving the caller's Supabase session, mapping any
 * thrown error (httpError or otherwise) to a safe JSON error response.
 */
export async function runAuthenticated(context, handler) {
  try {
    const { user, token } = await requireUser(context);
    return await handler({ user, token });
  } catch (error) {
    return errorResponse(error, { label: "prelude-worker" });
  }
}

/**
 * Resolves the caller's role, preferring auth metadata (already verified by
 * requireUser, no extra round trip) and falling back to the profile row.
 */
export async function resolveCallerRole(context, user, token) {
  if (user.user_metadata?.role) return String(user.user_metadata.role).toLowerCase();
  try {
    const rows = await rest(context, token, `profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`);
    return String(first(rows)?.role || "student").toLowerCase();
  } catch {
    return "student";
  }
}

/** REST call scoped to the caller's own bearer token (subject to RLS). */
export async function rest(context, token, path, options = {}) {
  const { url, key } = config(context);
  const response = await runtimeFetch(context)(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw Object.assign(new Error(body?.message || body?.hint || "Supabase request failed."), {
      status: response.status,
      statusCode: response.status,
      details: body
    });
  }
  return body;
}

/** REST call using the service-role key, bypassing RLS. Use only for validated cross-user reads. */
export async function adminRest(context, path, options = {}) {
  const { url, serviceRoleKey } = config(context);
  if (!url || !serviceRoleKey) {
    throw httpError("This feature requires service role configuration.", 503, "service_unavailable");
  }
  const response = await runtimeFetch(context)(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw Object.assign(new Error(body?.message || body?.hint || "Supabase request failed."), {
      status: response.status,
      statusCode: response.status,
      details: body
    });
  }
  return body;
}

export const first = (rows) => (Array.isArray(rows) ? rows[0] || null : rows || null);

export const pickFields = (body, allowed) =>
  Object.fromEntries(Object.entries(body || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined));

export async function readJsonBody(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}

/**
 * Maps internal errors to a safe, minimal JSON payload. Never forwards SQL text,
 * Postgres relation/hint details, tokens, or stack traces to the client.
 */
export function errorResponse(error, { label = "prelude-worker", extraHeaders = {} } = {}) {
  if (error?.name === "ZodError") {
    return json(
      {
        error: "validation_error",
        message: error.issues?.[0]?.message || "The request could not be validated.",
        issues: error.issues
      },
      400,
      extraHeaders
    );
  }
  if (error instanceof SyntaxError) {
    return json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400, extraHeaders);
  }

  const status = Number(error?.statusCode || error?.status) || 500;
  const isServerError = status >= 500;
  const customCode = typeof error?.code === "string" && error.code.trim() ? error.code.trim() : null;
  const code =
    customCode ||
    (status === 401
      ? "unauthenticated"
      : status === 403
        ? "forbidden"
        : status === 404
          ? "not_found"
          : status === 409
            ? "conflict"
            : status === 422
              ? "validation_error"
              : isServerError
                ? "server_error"
                : "request_failed");

  if (isServerError) {
    console.error(`[${label}]`, { code, message: error?.message || String(error) });
  }

  return json(
    {
      error: code,
      message: isServerError ? "Something went wrong. Please try again." : error?.message || "Request failed."
    },
    status,
    extraHeaders
  );
}

export function methodNotAllowed(allow = DEFAULT_ALLOWED_METHODS) {
  return json({ error: "method_not_allowed", message: "This method is not supported for this route." }, 405, {
    Allow: allow
  });
}

export function notFound() {
  return json({ error: "not_found", message: "Route not found." }, 404);
}

/** Allowed cross-origin callers, e.g. a separate marketing site or preview deployment. */
function allowedOrigins(context) {
  const configured = context.env?.ALLOWED_ORIGINS || context.env?.CORS_ALLOWED_ORIGINS || "";
  const list = configured
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const appUrl = (context.env?.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (appUrl) list.push(appUrl);
  return new Set(list);
}

/** Builds CORS headers, allowlisting only configured origins (default-deny). */
export function corsHeaders(context, { methods = DEFAULT_ALLOWED_METHODS } = {}) {
  const origin = context.request.headers.get("Origin") || "";
  const allowed = allowedOrigins(context);
  const headers = { Vary: "Origin" };
  if (origin && allowed.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Headers"] = DEFAULT_ALLOWED_HEADERS;
    headers["Access-Control-Allow-Methods"] = methods;
  }
  return headers;
}

export function handlePreflight(context, { methods = DEFAULT_ALLOWED_METHODS } = {}) {
  return new Response(null, { status: 204, headers: corsHeaders(context, { methods }) });
}
