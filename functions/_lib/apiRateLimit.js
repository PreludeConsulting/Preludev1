import { RATE_LIMIT_TIERS, resolveApiRateLimitPolicy } from "../../server/lib/apiRateLimitPolicy.js";

const buckets = new Map();
const MESSAGE = "Too many requests. Please wait and try again.";

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function windowStartMs(now, windowSeconds) {
  const windowMs = windowSeconds * 1000;
  return Math.floor(now / windowMs) * windowMs;
}

function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"
  ).trim();
}

function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function clientKey(request, env = {}) {
  const ip = getClientIp(request);
  const secret = env.RATE_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
  return secret ? fnv1a(`${ip}:${secret}`) : ip;
}

async function memoryIncrement({ route, key, windowSeconds, now }) {
  const bucketKey = `${route}:${key}:${windowSeconds}`;
  const start = windowStartMs(now, windowSeconds);
  const current = buckets.get(bucketKey);
  if (!current || current.windowStart !== start) {
    const next = { windowStart: start, count: 1 };
    buckets.set(bucketKey, next);
    return { count: next.count, resetAt: start + windowSeconds * 1000 };
  }
  current.count += 1;
  return { count: current.count, resetAt: current.windowStart + windowSeconds * 1000 };
}

async function supabaseIncrement({ env, route, key, windowSeconds, now }) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase rate-limit storage is not configured.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/check_api_rate_limit`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_key: key,
      p_route: route,
      p_window_seconds: windowSeconds,
      p_now: new Date(now).toISOString()
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error("Supabase rate-limit RPC failed.");
  return {
    count: Number(payload.request_count || payload.count || 0),
    resetAt: Date.parse(payload.reset_at || payload.resetAt)
  };
}

async function increment(context, input) {
  if (context.env?.RATE_LIMIT_STORE === "memory" || context.env?.NODE_ENV === "test") {
    return memoryIncrement(input);
  }
  return supabaseIncrement({ env: context.env || {}, ...input });
}

function headersFor(result) {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
  };
}

async function checkCloudflareApiRateLimit(context) {
  const request = context.request;
  const url = new URL(request.url);
  const policy = resolveApiRateLimitPolicy(url.pathname, request.method);
  if (!policy || policy.exempt) return { allowed: true, policy };

  const tierConfig = RATE_LIMIT_TIERS[policy.tier];
  const key = clientKey(request, context.env || {});
  const route = policy.pattern || url.pathname;
  const now = Date.now();
  let mostConstrained = null;

  try {
    for (const window of tierConfig.windows) {
      const result = await increment(context, {
        route,
        key,
        windowSeconds: window.windowSeconds,
        now
      });
      const remaining = Math.max(0, window.limit - result.count);
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
      const candidate = {
        allowed: result.count <= window.limit,
        code: "rate_limit_exceeded",
        limit: window.limit,
        remaining,
        resetAt: result.resetAt,
        retryAfterSeconds
      };
      if (!candidate.allowed) return candidate;
      if (!mostConstrained || candidate.remaining < mostConstrained.remaining) mostConstrained = candidate;
    }
    return mostConstrained || { allowed: true, policy };
  } catch (error) {
    if (tierConfig.failClosed) {
      return {
        allowed: false,
        code: "rate_limit_unavailable",
        limit: tierConfig.windows[0].limit,
        remaining: 0,
        resetAt: now + tierConfig.windows[0].windowSeconds * 1000,
        retryAfterSeconds: tierConfig.windows[0].windowSeconds,
        cause: error
      };
    }
    console.warn("[cf-api-rate-limit] limiter unavailable; allowing non-cost route", error?.message || error);
    return { allowed: true, policy, degraded: true };
  }
}

export async function enforceCloudflareApiRateLimit(context) {
  const result = await checkCloudflareApiRateLimit(context);
  if (result.allowed) return null;
  return json(
    {
      error: result.code,
      message: MESSAGE,
      retryAfterSeconds: result.retryAfterSeconds
    },
    429,
    headersFor(result)
  );
}

export function resetCloudflareRateLimitBuckets() {
  buckets.clear();
}
