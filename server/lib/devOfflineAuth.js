/**
 * LOCAL DEVELOPMENT ONLY — demo login when PostgreSQL is not running.
 * Matches credentials in src/data/demoAccounts.js.
 */

import jwt from "jsonwebtoken";
import { isDatabaseUnavailableError } from "./dbErrors.js";

const OFFLINE_DEMO_USERS = [
  {
    id: "demo-student-jordan",
    firstName: "Jordan",
    lastName: "Lee",
    email: "student@prelude-demo.com",
    password: "Student123!",
    role: "STUDENT",
    plan: "BASIC",
    emailVerified: true,
    status: "ACTIVE",
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    stripeCustomerId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z")
  },
  {
    id: "demo-student-alex",
    firstName: "Alex",
    lastName: "Kim",
    email: "student2@prelude-demo.com",
    password: "Student123!",
    role: "STUDENT",
    plan: "BASIC",
    emailVerified: true,
    status: "ACTIVE",
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    stripeCustomerId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z")
  },
  {
    id: "demo-mentor-maya",
    firstName: "Maya",
    lastName: "Patel",
    email: "mentor@prelude-demo.com",
    password: "Mentor123!",
    role: "MENTOR",
    plan: "BASIC",
    emailVerified: true,
    status: "ACTIVE",
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    stripeCustomerId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z")
  }
];

const memoryRateBuckets = new Map();

let dbReachableCache = null;
let dbReachableCheckedAt = 0;
const DB_CHECK_TTL_MS = 8000;

export function isDevOfflineAuthEnabled() {
  return process.env.NODE_ENV !== "production";
}

export async function isDatabaseReachable(prisma) {
  if (!isDevOfflineAuthEnabled()) return true;
  const now = Date.now();
  if (dbReachableCache !== null && now - dbReachableCheckedAt < DB_CHECK_TTL_MS) {
    return dbReachableCache;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReachableCache = true;
  } catch {
    dbReachableCache = false;
  }
  dbReachableCheckedAt = now;
  return dbReachableCache;
}

export function invalidateDatabaseReachabilityCache() {
  dbReachableCache = null;
}

export async function devRateLimit(req, route, limit, windowSeconds, prisma, dbRateLimit) {
  if (await isDatabaseReachable(prisma)) {
    return dbRateLimit(req, route, limit, windowSeconds);
  }

  const ip = (req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown").trim();
  const key = `${route}:${ip}`;
  const windowStart = Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000;
  const bucketKey = `${key}:${windowStart}`;
  const current = (memoryRateBuckets.get(bucketKey) || 0) + 1;
  memoryRateBuckets.set(bucketKey, current);
  if (current > limit) {
    const error = new Error("Too many requests. Please try again later.");
    error.statusCode = 429;
    throw error;
  }
}

export function findOfflineDemoUser(email, password) {
  const normalized = (email || "").trim().toLowerCase();
  return (
    OFFLINE_DEMO_USERS.find((user) => user.email === normalized && user.password === password) || null
  );
}

export function getOfflineDemoUserById(userId) {
  return OFFLINE_DEMO_USERS.find((user) => user.id === userId) || null;
}

export function createOfflineSessionTokens(user, { randomToken, ACCESS_TTL_SECONDS, REFRESH_TTL_DAYS }) {
  const sessionId = `offline-${user.id}`;
  const refreshToken = randomToken(48);
  const csrfToken = randomToken(24);
  const accessToken = jwt.sign(
    {
      sub: user.id,
      role: user.role,
      sid: sessionId,
      emailVerified: true,
      offline: true
    },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "dev-only-change-me-before-production",
    {
      expiresIn: ACCESS_TTL_SECONDS,
      audience: "prelude-web",
      issuer: "prelude-api"
    }
  );

  if (!globalThis.__preludeOfflineSessions) globalThis.__preludeOfflineSessions = new Map();
  globalThis.__preludeOfflineSessions.set(sessionId, {
    id: sessionId,
    userId: user.id,
    expiresAt: Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  });

  return { sessionId, refreshToken, accessToken, csrfToken };
}

export function getOfflineAuthFromTokenClaims(claims) {
  if (!claims?.offline) return null;
  const user = getOfflineDemoUserById(claims.sub);
  if (!user) return null;
  const session = globalThis.__preludeOfflineSessions?.get(claims.sid);
  if (!session || session.expiresAt <= Date.now()) return null;
  return { user, session: { id: claims.sid, userId: user.id, status: "ACTIVE" } };
}

export function shouldAttemptOfflineLogin(error) {
  return isDevOfflineAuthEnabled() && isDatabaseUnavailableError(error);
}

export const OFFLINE_LOGIN_HINT =
  "Signed in with offline demo mode (database not running). Start PostgreSQL with: npm run db:start";
