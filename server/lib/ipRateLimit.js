import { createHash } from "node:crypto";

const buckets = new Map();

function bucketKey(route, ip) {
  return `${route}:${ip}`;
}

export function getClientIp(req) {
  return (req?.headers?.["x-forwarded-for"]?.split(",")[0] || req?.socket?.remoteAddress || "").trim() || "unknown";
}

export function hashClientIp(req, secret = "") {
  const ip = getClientIp(req);
  if (!secret) return ip;
  return createHash("sha256").update(`${ip}:${secret}`).digest("hex").slice(0, 24);
}

/**
 * Simple in-memory fixed-window rate limiter (works in Node dev server and short-lived workers).
 */
export function checkIpRateLimit({ route, ip, limit, windowMs, now = Date.now() }) {
  const key = bucketKey(route, ip);
  const current = buckets.get(key);

  if (!current || now - current.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.windowStart + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function enforceIpRateLimit(req, route, limit, windowSeconds, env = process.env) {
  const ip = hashClientIp(req, env.RATE_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "");
  const result = checkIpRateLimit({
    route,
    ip,
    limit,
    windowMs: windowSeconds * 1000
  });

  if (result.allowed) return null;

  const error = new Error("Too many password reset attempts. Please wait a moment and try again.");
  error.statusCode = 429;
  error.code = "rate_limit_exceeded";
  error.retryAfterSeconds = result.retryAfterSeconds;
  return error;
}

/** Test helper — clears the in-memory bucket store. */
export function resetIpRateLimitBuckets() {
  buckets.clear();
}
