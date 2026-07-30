import { sendJson } from "../http.js";
import { db, sendJson as sendAuthJson } from "../authApi.js";
import { getClientIp, hashClientIp } from "./ipRateLimit.js";
import { RATE_LIMIT_TIERS, resolveApiRateLimitPolicy } from "./apiRateLimitPolicy.js";

const RATE_LIMIT_MESSAGE = "Too many requests. Please wait and try again.";

function windowStartMs(now, windowSeconds) {
  const windowMs = windowSeconds * 1000;
  return Math.floor(now / windowMs) * windowMs;
}

function routeKey(route, ip, windowSeconds) {
  return `${route}:${ip}:${windowSeconds}`;
}

export function createMemoryRateLimitStore() {
  const buckets = new Map();
  return {
    async increment({ route, key, windowSeconds, now = Date.now() }) {
      const bucketKey = routeKey(route, key, windowSeconds);
      const start = windowStartMs(now, windowSeconds);
      const current = buckets.get(bucketKey);
      if (!current || current.windowStart !== start) {
        const next = { windowStart: start, count: 1 };
        buckets.set(bucketKey, next);
        return {
          count: next.count,
          resetAt: start + windowSeconds * 1000
        };
      }
      current.count += 1;
      return {
        count: current.count,
        resetAt: current.windowStart + windowSeconds * 1000
      };
    },
    reset() {
      buckets.clear();
    }
  };
}

export function createPrismaRateLimitStore({ prisma = db } = {}) {
  return {
    async increment({ route, key, windowSeconds, now = Date.now() }) {
      const windowStart = new Date(windowStartMs(now, windowSeconds));
      const bucket = await prisma().rateLimitBucket.upsert({
        where: { key_route_windowStart: { key, route, windowStart } },
        create: { key, route, windowStart, windowSeconds, requestCount: 1 },
        update: { requestCount: { increment: 1 } }
      });
      return {
        count: bucket.requestCount,
        resetAt: windowStart.getTime() + windowSeconds * 1000
      };
    }
  };
}

function createRateLimitPayload(code, retryAfterSeconds) {
  return {
    error: code,
    message: RATE_LIMIT_MESSAGE,
    retryAfterSeconds
  };
}

function limitHeaders({ limit, remaining, resetAt, retryAfterSeconds }) {
  return {
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000))
  };
}

export async function checkApiRateLimit({
  pathname,
  method,
  req,
  store,
  env = process.env,
  now = Date.now()
}) {
  const policy = resolveApiRateLimitPolicy(pathname, method);
  if (!policy || policy.exempt) return { allowed: true, policy };

  const tierConfig = RATE_LIMIT_TIERS[policy.tier];
  const clientKey = hashClientIp(req, env.RATE_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "");
  const route = policy.pattern || pathname;
  let mostConstrained = null;

  try {
    for (const window of tierConfig.windows) {
      const result = await store.increment({
        route,
        key: clientKey || getClientIp(req),
        windowSeconds: window.windowSeconds,
        now
      });
      const remaining = Math.max(0, window.limit - result.count);
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
      const candidate = {
        allowed: result.count <= window.limit,
        code: "rate_limit_exceeded",
        policy,
        limit: window.limit,
        remaining,
        resetAt: result.resetAt,
        retryAfterSeconds
      };
      if (!candidate.allowed) return candidate;
      if (!mostConstrained || remaining < mostConstrained.remaining) mostConstrained = candidate;
    }
    return mostConstrained || { allowed: true, policy };
  } catch (error) {
    if (tierConfig.failClosed) {
      return {
        allowed: false,
        code: "rate_limit_unavailable",
        policy,
        limit: tierConfig.windows[0].limit,
        remaining: 0,
        resetAt: now + tierConfig.windows[0].windowSeconds * 1000,
        retryAfterSeconds: tierConfig.windows[0].windowSeconds,
        cause: error
      };
    }
    console.warn("[api-rate-limit] limiter unavailable; allowing non-cost route", error?.message || error);
    return { allowed: true, policy, degraded: true };
  }
}

export function createApiRateLimitMiddleware({
  store = createPrismaRateLimitStore(),
  env = process.env,
  now = Date.now
} = {}) {
  return async function apiRateLimitMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const result = await checkApiRateLimit({
      pathname: url.pathname,
      method: req.method,
      req,
      store,
      env,
      now: now()
    });
    if (result.allowed) {
      return await next();
    }

    const headers = limitHeaders(result);
    const payload = createRateLimitPayload(result.code, result.retryAfterSeconds);
    const writer = typeof res.status === "function" ? sendAuthJson : sendJson;
    writer(res, 429, payload, headers);
  };
}

export function withApiRateLimit(handler, options = {}) {
  const middleware = createApiRateLimitMiddleware(options);
  return async function rateLimitedHandler(req, res) {
    return middleware(req, res, () => handler(req, res));
  };
}

export function rateLimitResponseInit(result) {
  const headers = new Headers(limitHeaders(result));
  headers.set("Content-Type", "application/json");
  return {
    status: 429,
    headers,
    body: createRateLimitPayload(result.code, result.retryAfterSeconds)
  };
}
