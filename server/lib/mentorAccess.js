import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { isDatabaseUnavailableError } from "./dbErrors.js";
import { assertDurableStoreAvailable } from "./durableStorePolicy.js";
import {
  buildDailyBookingLimitError,
  buildNoMentorAccessError,
  evaluateMentorAccess,
  hasActiveMentorSubscription,
  isEssaySupportBundleId,
  isLiveSessionBundleId,
  NO_MENTOR_ACCESS_CODE,
  normalizePlanId
} from "../../shared/mentorAccess.js";
import {
  attachReservationMeetingId,
  ensureSessionPeriodForActiveSubscription,
  expireSessionPeriodsAtPeriodEnd,
  getSessionCreditSummary,
  releaseSubscriptionSessionCredit,
  reserveSubscriptionSessionCredit
} from "./sessionCredits.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "../data/session-packages.json");

/** Serialize JSON-store mutations so concurrent requests cannot double-spend the last session. */
let jsonPackageQueue = Promise.resolve();

function withJsonPackageLock(fn) {
  const run = jsonPackageQueue.then(fn, fn);
  jsonPackageQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function prismaClient() {
  if (!globalThis.__preludePrisma) globalThis.__preludePrisma = new PrismaClient();
  return globalThis.__preludePrisma;
}

function canUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function ensureJsonStore() {
  const dir = dirname(DATA_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify({ packages: [] }, null, 2));
  }
}

function readJsonStore() {
  ensureJsonStore();
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function writeJsonStore(data) {
  ensureJsonStore();
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function toPackageRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentUserId: row.studentUserId,
    mentorUserId: row.mentorUserId ?? null,
    bundleId: row.bundleId || "flexible_sessions",
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? null,
    sessionsPurchased: Number(row.sessionsPurchased) || 0,
    sessionsRemaining: Number(row.sessionsRemaining) || 0,
    status: row.status || "active",
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ?? null,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ?? null
  };
}

function userFacingAccessError(message) {
  const payload = buildNoMentorAccessError(message);
  const error = new Error(payload.message);
  error.statusCode = 403;
  error.code = NO_MENTOR_ACCESS_CODE;
  return error;
}

function isUsablePackage(pkg, mentorId = null, now = Date.now()) {
  if (!pkg || String(pkg.status || "").toLowerCase() !== "active") return false;
  if (!isLiveSessionBundleId(pkg.bundleId)) return false;
  if (Number(pkg.sessionsRemaining) <= 0) return false;
  if (pkg.expiresAt) {
    const expires = new Date(pkg.expiresAt).getTime();
    if (!Number.isNaN(expires) && expires <= now) return false;
  }
  if (pkg.mentorUserId && mentorId && pkg.mentorUserId !== mentorId) return false;
  if (pkg.mentorUserId && !mentorId) return false;
  return true;
}

function isUsableEssayPackage(pkg, now = Date.now()) {
  if (!pkg || String(pkg.status || "").toLowerCase() !== "active") return false;
  if (!isEssaySupportBundleId(pkg.bundleId)) return false;
  if (Number(pkg.sessionsRemaining) <= 0) return false;
  if (pkg.expiresAt) {
    const expires = new Date(pkg.expiresAt).getTime();
    if (!Number.isNaN(expires) && expires <= now) return false;
  }
  return true;
}

export async function listSessionPackagesForStudent(studentUserId) {
  if (!studentUserId) return [];
  if (canUsePrisma()) {
    try {
      const rows = await prismaClient().sessionPackagePurchase.findMany({
        where: { studentUserId },
        orderBy: { createdAt: "asc" }
      });
      return rows.map(toPackageRecord);
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }
  assertDurableStoreAvailable(process.env, "session package");
  const { packages } = readJsonStore();
  return packages.filter((pkg) => pkg.studentUserId === studentUserId).map(toPackageRecord);
}

/**
 * Credit a flexible-sessions purchase after Stripe checkout (idempotent on checkout session id).
 */
export async function creditSessionPackagePurchase({
  studentUserId,
  mentorUserId = null,
  sessionsPurchased,
  stripeCheckoutSessionId = null,
  bundleId = "flexible_sessions",
  expiresAt = null
}) {
  const qty = Math.floor(Number(sessionsPurchased));
  if (!studentUserId || !Number.isFinite(qty) || qty <= 0) return null;

  if (canUsePrisma()) {
    try {
      if (stripeCheckoutSessionId) {
        const existing = await prismaClient().sessionPackagePurchase.findUnique({
          where: { stripeCheckoutSessionId }
        });
        if (existing) return toPackageRecord(existing);
      }
      const row = await prismaClient().sessionPackagePurchase.create({
        data: {
          studentUserId,
          mentorUserId: mentorUserId || null,
          bundleId,
          stripeCheckoutSessionId: stripeCheckoutSessionId || null,
          sessionsPurchased: qty,
          sessionsRemaining: qty,
          status: "active",
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });
      return toPackageRecord(row);
    } catch (error) {
      if (error.code === "P2002" && stripeCheckoutSessionId) {
        const existing = await prismaClient().sessionPackagePurchase.findUnique({
          where: { stripeCheckoutSessionId }
        });
        return toPackageRecord(existing);
      }
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }

  assertDurableStoreAvailable(process.env, "session package");
  const store = readJsonStore();
  if (stripeCheckoutSessionId) {
    const existing = store.packages.find((pkg) => pkg.stripeCheckoutSessionId === stripeCheckoutSessionId);
    if (existing) return toPackageRecord(existing);
  }
  const record = toPackageRecord({
    id: `pkg-${randomBytes(6).toString("hex")}`,
    studentUserId,
    mentorUserId: mentorUserId || null,
    bundleId,
    stripeCheckoutSessionId: stripeCheckoutSessionId || null,
    sessionsPurchased: qty,
    sessionsRemaining: qty,
    status: "active",
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  store.packages.push(record);
  writeJsonStore(store);
  return record;
}

/**
 * Centralized access check for mentor requests.
 * @returns {{ allowed: boolean, accessType: "session_package"|"subscription"|null, remainingSessions: number, reason: string|null, subscriptionRemaining: number, packageRemaining: number }}
 */
export async function canRequestMentor({
  studentId,
  mentorId = null,
  user = null,
  meetings = []
} = {}) {
  const studentUserId = studentId || user?.id;
  if (!studentUserId) {
    return {
      allowed: false,
      accessType: null,
      remainingSessions: 0,
      subscriptionRemaining: 0,
      packageRemaining: 0,
      allowance: 0,
      periodEnd: null,
      sessionCreditBalanceLabel: null,
      reason: "unauthenticated"
    };
  }

  let accessUser = user;
  if (!accessUser && canUsePrisma()) {
    try {
      accessUser = await prismaClient().user.findUnique({
        where: { id: studentUserId },
        select: {
          id: true,
          plan: true,
          subscriptionStatus: true,
          subscriptionCurrentPeriodEnd: true,
          stripeSubscriptionId: true
        }
      });
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }
  accessUser = accessUser || { id: studentUserId, plan: "basic" };

  await expireSessionPeriodsAtPeriodEnd(studentUserId);
  if (hasActiveMentorSubscription(accessUser)) {
    await ensureSessionPeriodForActiveSubscription({
      studentUserId,
      planId: accessUser.plan || accessUser.subscriptionPlan || accessUser.planName,
      periodStart: accessUser.subscriptionCurrentPeriodStart || accessUser.subscription_current_period_start,
      periodEnd: accessUser.subscriptionCurrentPeriodEnd || accessUser.subscription_current_period_end,
      stripeSubscriptionId: accessUser.stripeSubscriptionId || accessUser.stripe_subscription_id || null
    });
  }

  const creditSummary = await getSessionCreditSummary(studentUserId);
  const packages = await listSessionPackagesForStudent(studentUserId);
  return evaluateMentorAccess({
    user: accessUser,
    mentorId,
    meetings,
    packages,
    sessionCredits: creditSummary
  });
}

async function pickPackageForConsume(packages, mentorId) {
  return packages.find((pkg) => isUsablePackage(pkg, mentorId)) || null;
}

const LIVE_SESSION_BUNDLE_FILTER = {
  OR: [{ bundleId: "flexible_sessions" }, { bundleId: "flexible" }]
};

async function decrementPackageCredit({ client, candidate }) {
  const updated = await client.sessionPackagePurchase.updateMany({
    where: {
      id: candidate.id,
      status: "active",
      sessionsRemaining: { gt: 0 }
    },
    data: {
      sessionsRemaining: { decrement: 1 },
      updatedAt: new Date()
    }
  });
  if (updated.count !== 1) return null;
  const remaining = candidate.sessionsRemaining - 1;
  if (remaining <= 0) {
    await client.sessionPackagePurchase.update({
      where: { id: candidate.id },
      data: { status: "depleted" }
    });
  }
  return candidate.id;
}

/**
 * Atomically reserve one live session package credit. Returns the package id or null.
 * Never consumes essay_support review packages.
 */
export async function consumePackageSession({ studentUserId, mentorId = null, tx = null }) {
  if (tx) {
    const candidates = await tx.sessionPackagePurchase.findMany({
      where: {
        studentUserId,
        status: "active",
        sessionsRemaining: { gt: 0 },
        AND: [
          LIVE_SESSION_BUNDLE_FILTER,
          {
            OR: [{ mentorUserId: null }, ...(mentorId ? [{ mentorUserId: mentorId }] : [])]
          },
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        ]
      },
      orderBy: { createdAt: "asc" }
    });

    for (const candidate of candidates) {
      if (!isLiveSessionBundleId(candidate.bundleId)) continue;
      const id = await decrementPackageCredit({ client: tx, candidate });
      if (id) return id;
    }
    return null;
  }

  if (canUsePrisma()) {
    try {
      const client = prismaClient();
      const candidates = await client.sessionPackagePurchase.findMany({
        where: {
          studentUserId,
          status: "active",
          sessionsRemaining: { gt: 0 },
          AND: [
            LIVE_SESSION_BUNDLE_FILTER,
            {
              OR: [{ mentorUserId: null }, ...(mentorId ? [{ mentorUserId: mentorId }] : [])]
            },
            {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            }
          ]
        },
        orderBy: { createdAt: "asc" }
      });

      for (const candidate of candidates) {
        if (!isLiveSessionBundleId(candidate.bundleId)) continue;
        const id = await decrementPackageCredit({ client, candidate });
        if (id) return id;
      }
      return null;
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }

  assertDurableStoreAvailable(process.env, "session package");
  // JSON fallback with serialized lock (single-process tests / local).
  return withJsonPackageLock(async () => {
    const store = readJsonStore();
    const idx = store.packages.findIndex(
      (pkg) => pkg.studentUserId === studentUserId && isUsablePackage(pkg, mentorId)
    );
    if (idx < 0) return null;
    const pkg = store.packages[idx];
    pkg.sessionsRemaining = Number(pkg.sessionsRemaining) - 1;
    if (pkg.sessionsRemaining <= 0) pkg.status = "depleted";
    pkg.updatedAt = new Date().toISOString();
    store.packages[idx] = pkg;
    writeJsonStore(store);
    return pkg.id;
  });
}

/**
 * Atomically consume one essay_support review credit (FIFO). Returns package id or null.
 */
export async function consumeEssayReviewCredit(studentUserId) {
  if (!studentUserId) return null;

  if (canUsePrisma()) {
    try {
      const client = prismaClient();
      const candidates = await client.sessionPackagePurchase.findMany({
        where: {
          studentUserId,
          bundleId: "essay_support",
          status: "active",
          sessionsRemaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        orderBy: { createdAt: "asc" }
      });

      for (const candidate of candidates) {
        const id = await decrementPackageCredit({ client, candidate });
        if (id) return id;
      }
      return null;
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }

  assertDurableStoreAvailable(process.env, "session package");
  return withJsonPackageLock(async () => {
    const store = readJsonStore();
    const idx = store.packages.findIndex(
      (pkg) => pkg.studentUserId === studentUserId && isUsableEssayPackage(pkg)
    );
    if (idx < 0) return null;
    const pkg = store.packages[idx];
    pkg.sessionsRemaining = Number(pkg.sessionsRemaining) - 1;
    if (pkg.sessionsRemaining <= 0) pkg.status = "depleted";
    pkg.updatedAt = new Date().toISOString();
    store.packages[idx] = pkg;
    writeJsonStore(store);
    return pkg.id;
  });
}

export async function releasePackageSession({ packageId, tx = null }) {
  if (!packageId) return false;

  if (tx) {
    const pkg = await tx.sessionPackagePurchase.findUnique({ where: { id: packageId } });
    if (!pkg) return false;
    await tx.sessionPackagePurchase.update({
      where: { id: packageId },
      data: {
        sessionsRemaining: { increment: 1 },
        status: "active",
        updatedAt: new Date()
      }
    });
    return true;
  }

  if (canUsePrisma()) {
    try {
      const pkg = await prismaClient().sessionPackagePurchase.findUnique({ where: { id: packageId } });
      if (!pkg) return false;
      await prismaClient().sessionPackagePurchase.update({
        where: { id: packageId },
        data: {
          sessionsRemaining: { increment: 1 },
          status: "active",
          updatedAt: new Date()
        }
      });
      return true;
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) throw error;
    }
  }

  return withJsonPackageLock(async () => {
    const store = readJsonStore();
    const idx = store.packages.findIndex((pkg) => pkg.id === packageId);
    if (idx < 0) return false;
    store.packages[idx].sessionsRemaining = Number(store.packages[idx].sessionsRemaining) + 1;
    store.packages[idx].status = "active";
    store.packages[idx].updatedAt = new Date().toISOString();
    writeJsonStore(store);
    return true;
  });
}

/**
 * Resolve access for a new student mentor request and optionally consume a package session.
 * Subscription access does not deduct package inventory.
 */
export async function assertMentorRequestAccess({
  studentUserId,
  mentorUserId = null,
  user = null,
  meetings = []
}) {
  const access = await canRequestMentor({
    studentId: studentUserId,
    mentorId: mentorUserId,
    user,
    meetings
  });

  if (!access.allowed) {
    if (access.reason === "daily_booking_limit") {
      const payload = buildDailyBookingLimitError();
      const error = new Error(payload.message);
      error.statusCode = 409;
      error.code = payload.code;
      throw error;
    }
    if (access.reason === "no_session_credits") {
      const error = new Error("You have no session credits remaining for the current billing period.");
      error.statusCode = 409;
      error.code = "NO_SESSION_CREDITS";
      throw error;
    }
    throw userFacingAccessError(
      "You need an available session or an active subscription to request this mentor."
    );
  }

  return access;
}

/**
 * Consume package inventory when accessType is session_package.
 * For subscription access, reserve exactly one paid-period session credit.
 * Safe under concurrency: updateMany / FOR UPDATE only succeeds when remaining > 0.
 */
export async function reserveAccessForMeeting({
  access,
  studentUserId,
  mentorUserId = null,
  idempotencyKey = null,
  meetingId = null,
  tx = null
}) {
  if (!access?.allowed) {
    throw userFacingAccessError(
      "You need an available session or an active subscription to request this mentor."
    );
  }

  if (access.accessType === "subscription") {
    try {
      const reserved = await reserveSubscriptionSessionCredit({
        studentUserId,
        idempotencyKey: idempotencyKey || `subscription-reserve:${studentUserId}:${Date.now()}`,
        meetingId,
        tx
      });
      return {
        accessType: "subscription",
        sessionPackageId: null,
        subscriptionSessionPeriodId: reserved.periodId || null
      };
    } catch (error) {
      if (error.code === "NO_SESSION_CREDITS") {
        const denied = new Error(error.message);
        denied.statusCode = 409;
        denied.code = "NO_SESSION_CREDITS";
        throw denied;
      }
      throw error;
    }
  }

  const packageId = await consumePackageSession({
    studentUserId,
    mentorId: mentorUserId,
    tx
  });
  if (!packageId) {
    // Race: last session taken by another request.
    throw userFacingAccessError(
      "You need an available session or an active subscription to request this mentor."
    );
  }

  return { accessType: "session_package", sessionPackageId: packageId, subscriptionSessionPeriodId: null };
}

export {
  pickPackageForConsume,
  userFacingAccessError,
  NO_MENTOR_ACCESS_CODE,
  attachReservationMeetingId,
  releaseSubscriptionSessionCredit,
  normalizePlanId
};
