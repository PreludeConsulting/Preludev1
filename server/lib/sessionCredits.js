/**
 * Authoritative Plus/Pro session credits scoped to Stripe-paid billing periods.
 *
 * Lifecycle:
 *   invoice.paid → open period with exact plan allowance (2 Plus / 4 Pro)
 *   booking submit → reserve 1 credit atomically (idempotent)
 *   renewal paid → expire prior unused credits; open new period at exact allowance
 *   cancel at period end → keep remaining until Stripe period_end, then expire
 *   failed payment → do not grant / reset
 */

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getMonthlyOneOnOneLimit, normalizePlanId } from "../../shared/mentorAccess.js";
import { isDatabaseUnavailableError } from "./dbErrors.js";
import { assertDurableStoreAvailable } from "./durableStorePolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = join(__dirname, "../data/subscription-session-periods.json");

export const SESSION_PERIOD_STATUS = Object.freeze({
  ACTIVE: "active",
  EXPIRED: "expired",
  SUPERSEDED: "superseded"
});

function prismaClient() {
  if (!globalThis.__preludePrisma) globalThis.__preludePrisma = new PrismaClient();
  return globalThis.__preludePrisma;
}

function canUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function ensureStore() {
  const dir = dirname(STORE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_FILE)) {
    writeFileSync(STORE_FILE, JSON.stringify({ periods: [], reservations: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(readFileSync(STORE_FILE, "utf8"));
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapPeriod(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentUserId: row.student_user_id || row.studentUserId,
    planId: row.plan_id || row.planId,
    allowance: Number(row.allowance) || 0,
    remaining: Math.max(0, Number(row.remaining) || 0),
    status: row.status,
    periodStart: toIso(row.period_start || row.periodStart),
    periodEnd: toIso(row.period_end || row.periodEnd),
    stripeSubscriptionId: row.stripe_subscription_id || row.stripeSubscriptionId || null,
    stripeInvoiceId: row.stripe_invoice_id || row.stripeInvoiceId || null,
    stripeEventId: row.stripe_event_id || row.stripeEventId || null,
    idempotencyKey: row.idempotency_key || row.idempotencyKey,
    createdAt: toIso(row.created_at || row.createdAt),
    updatedAt: toIso(row.updated_at || row.updatedAt)
  };
}

export function getPlanSessionAllowance(planId) {
  return getMonthlyOneOnOneLimit(planId);
}

export function summarizeSessionPeriod(period) {
  if (!period || period.status !== SESSION_PERIOD_STATUS.ACTIVE) {
    return {
      allowance: 0,
      remaining: 0,
      used: 0,
      periodEnd: null,
      planId: null,
      active: false
    };
  }
  const allowance = Math.max(0, Number(period.allowance) || 0);
  const remaining = Math.max(0, Number(period.remaining) || 0);
  return {
    allowance,
    remaining,
    used: Math.max(0, allowance - remaining),
    periodEnd: period.periodEnd || null,
    planId: period.planId || null,
    active: true,
    periodId: period.id
  };
}

export function formatSessionCreditBalanceLabel(summary) {
  if (!summary?.active || !summary.allowance) return null;
  return `${summary.remaining} of ${summary.allowance} session credit${summary.allowance === 1 ? "" : "s"} remaining`;
}

async function listPeriodsRaw(studentUserId) {
  if (!studentUserId) return [];
  if (canUsePrisma()) {
    try {
      const rows = await prismaClient().$queryRawUnsafe(
        `SELECT id, student_user_id, plan_id, allowance, remaining, status, period_start, period_end,
                stripe_subscription_id, stripe_invoice_id, stripe_event_id, idempotency_key, created_at, updated_at
         FROM subscription_session_periods
         WHERE student_user_id = $1::uuid
         ORDER BY period_start DESC, created_at DESC`,
        studentUserId
      );
      return (rows || []).map(mapPeriod);
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/subscription_session_periods/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }
  assertDurableStoreAvailable(process.env, "subscription session periods");
  return readStore().periods.filter((period) => period.studentUserId === studentUserId).map(mapPeriod);
}

export async function getActiveSessionPeriod(studentUserId, { now = new Date() } = {}) {
  const periods = await listPeriodsRaw(studentUserId);
  const nowMs = now.getTime();
  return (
    periods.find((period) => {
      if (period.status !== SESSION_PERIOD_STATUS.ACTIVE) return false;
      const end = period.periodEnd ? new Date(period.periodEnd).getTime() : null;
      if (end != null && !Number.isNaN(end) && end <= nowMs) return false;
      return true;
    }) || null
  );
}

export async function getSessionCreditSummary(studentUserId, { now = new Date() } = {}) {
  const period = await getActiveSessionPeriod(studentUserId, { now });
  return summarizeSessionPeriod(period);
}

/**
 * Mid-cycle Plus→Pro switch.
 * Plus→Pro upgrade: reset remaining to the full Pro allowance (do not preserve Plus balance).
 * Pro→Plus is not supported as a direct plan change.
 * Does not touch Essay Support / review credits.
 */
export async function reconcileActiveSessionPeriodForPlanChange(
  studentUserId,
  planId,
  { now = new Date(), resetRemaining = null } = {}
) {
  const normalizedPlan = normalizePlanId(planId);
  const newAllowance = getPlanSessionAllowance(normalizedPlan);
  if (!studentUserId || !newAllowance) return null;

  const period = await getActiveSessionPeriod(studentUserId, { now });
  if (!period?.id) return null;

  const priorAllowance = Number(period.allowance) || 0;
  const used = Math.max(0, priorAllowance - (Number(period.remaining) || 0));
  const isUpgrade = newAllowance > priorAllowance;
  const shouldReset = resetRemaining == null ? isUpgrade : Boolean(resetRemaining);
  const remaining = shouldReset ? newAllowance : Math.max(0, newAllowance - used);
  const updatedAt = new Date().toISOString();

  if (canUsePrisma()) {
    try {
      await prismaClient().$executeRawUnsafe(
        `UPDATE subscription_session_periods
         SET plan_id = $2, allowance = $3, remaining = $4, updated_at = $5::timestamptz
         WHERE id = $1::uuid AND status = 'active'`,
        period.id,
        normalizedPlan,
        newAllowance,
        remaining,
        updatedAt
      );
      return {
        ...period,
        planId: normalizedPlan,
        allowance: newAllowance,
        remaining,
        updatedAt
      };
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/subscription_session_periods/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }

  assertDurableStoreAvailable(process.env, "subscription session periods");
  const store = readStore();
  const row = store.periods.find((entry) => entry.id === period.id);
  if (!row) return null;
  row.planId = normalizedPlan;
  row.allowance = newAllowance;
  row.remaining = remaining;
  row.updatedAt = updatedAt;
  writeStore(store);
  return mapPeriod(row);
}

/**
 * Bootstrap a period for an already-active Plus/Pro subscription that has no ledger row yet
 * (migration / demo / promo). Does not invent a new allowance after a prior period expires
 * without a successful payment — only opens a window when none exists for these bounds.
 * Authoritative renewals still go through activateSessionPeriodFromPayment (invoice.paid).
 */
export async function ensureSessionPeriodForActiveSubscription({
  studentUserId,
  planId,
  periodStart = null,
  periodEnd = null,
  stripeSubscriptionId = null
}) {
  const normalizedPlan = normalizePlanId(planId);
  const allowance = getPlanSessionAllowance(normalizedPlan);
  if (!studentUserId || !allowance) return null;

  const existing = await getActiveSessionPeriod(studentUserId);
  if (existing) return existing;

  const endIso = toIso(periodEnd);
  if (endIso) {
    const startIso =
      toIso(periodStart) || new Date(new Date(endIso).getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
    // Do not open a period whose Stripe end is already past.
    if (new Date(endIso).getTime() <= Date.now()) return null;
    return activateSessionPeriodFromPayment({
      studentUserId,
      planId: normalizedPlan,
      periodStart: startIso,
      periodEnd: endIso,
      stripeSubscriptionId,
      idempotencyKey: `session-period:ensure:${studentUserId}:${startIso}:${endIso}`
    });
  }

  // Demo / promo without Stripe period bounds: only seed once per student.
  const prior = await listPeriodsRaw(studentUserId);
  if (prior.length > 0) return null;

  const start = toIso(periodStart) || new Date().toISOString();
  const end = new Date(new Date(start).getTime() + 28 * 24 * 60 * 60 * 1000).toISOString();
  return activateSessionPeriodFromPayment({
    studentUserId,
    planId: normalizedPlan,
    periodStart: start,
    periodEnd: end,
    stripeSubscriptionId,
    idempotencyKey: `session-period:ensure-demo:${studentUserId}`
  });
}

async function expireActivePeriods(studentUserId, { reason = "superseded", exceptId = null } = {}) {
  if (canUsePrisma()) {
    try {
      await prismaClient().$executeRawUnsafe(
        `UPDATE subscription_session_periods
         SET status = $2, updated_at = NOW()
         WHERE student_user_id = $1::uuid
           AND status = 'active'
           AND ($3::uuid IS NULL OR id <> $3::uuid)`,
        studentUserId,
        reason === "expired" ? SESSION_PERIOD_STATUS.EXPIRED : SESSION_PERIOD_STATUS.SUPERSEDED,
        exceptId
      );
      return;
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/subscription_session_periods/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }
  const store = readStore();
  for (const period of store.periods) {
    if (period.studentUserId !== studentUserId) continue;
    if (period.status !== SESSION_PERIOD_STATUS.ACTIVE) continue;
    if (exceptId && period.id === exceptId) continue;
    period.status = reason === "expired" ? SESSION_PERIOD_STATUS.EXPIRED : SESSION_PERIOD_STATUS.SUPERSEDED;
    period.updatedAt = new Date().toISOString();
  }
  writeStore(store);
}

/**
 * Open a paid billing period with the exact plan allowance.
 * Idempotent on stripe invoice id / idempotency key. Unused prior credits do not roll over.
 */
export async function activateSessionPeriodFromPayment({
  studentUserId,
  planId,
  periodStart,
  periodEnd,
  stripeSubscriptionId = null,
  stripeInvoiceId = null,
  stripeEventId = null,
  idempotencyKey = null
}) {
  const normalizedPlan = normalizePlanId(planId);
  const allowance = getPlanSessionAllowance(normalizedPlan);
  if (!studentUserId || !allowance) return null;

  const startIso = toIso(periodStart) || new Date().toISOString();
  const endIso = toIso(periodEnd);
  if (!endIso) {
    throw new Error("Session period activation requires Stripe current_period_end.");
  }

  const key =
    String(idempotencyKey || "").trim() ||
    (stripeInvoiceId ? `session-period:invoice:${stripeInvoiceId}` : null) ||
    `session-period:sub:${stripeSubscriptionId}:${startIso}:${endIso}`;

  if (canUsePrisma()) {
    try {
      const existing = await prismaClient().$queryRawUnsafe(
        `SELECT id, student_user_id, plan_id, allowance, remaining, status, period_start, period_end,
                stripe_subscription_id, stripe_invoice_id, stripe_event_id, idempotency_key, created_at, updated_at
         FROM subscription_session_periods
         WHERE idempotency_key = $1
         LIMIT 1`,
        key
      );
      if (existing?.[0]) return mapPeriod(existing[0]);

      await expireActivePeriods(studentUserId, { reason: "superseded" });
      const id = randomUUID();
      await prismaClient().$executeRawUnsafe(
        `INSERT INTO subscription_session_periods
          (id, student_user_id, plan_id, allowance, remaining, status, period_start, period_end,
           stripe_subscription_id, stripe_invoice_id, stripe_event_id, idempotency_key, created_at, updated_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, $4, 'active', $5::timestamptz, $6::timestamptz,
                 $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (idempotency_key) DO NOTHING`,
        id,
        studentUserId,
        normalizedPlan,
        allowance,
        startIso,
        endIso,
        stripeSubscriptionId,
        stripeInvoiceId,
        stripeEventId,
        key
      );
      const created = await prismaClient().$queryRawUnsafe(
        `SELECT id, student_user_id, plan_id, allowance, remaining, status, period_start, period_end,
                stripe_subscription_id, stripe_invoice_id, stripe_event_id, idempotency_key, created_at, updated_at
         FROM subscription_session_periods
         WHERE idempotency_key = $1
         LIMIT 1`,
        key
      );
      return mapPeriod(created?.[0] || null);
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/subscription_session_periods/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }

  assertDurableStoreAvailable(process.env, "subscription session periods");
  const store = readStore();
  const existing = store.periods.find((period) => period.idempotencyKey === key);
  if (existing) return mapPeriod(existing);

  for (const period of store.periods) {
    if (period.studentUserId === studentUserId && period.status === SESSION_PERIOD_STATUS.ACTIVE) {
      period.status = SESSION_PERIOD_STATUS.SUPERSEDED;
      period.updatedAt = new Date().toISOString();
    }
  }

  const record = {
    id: randomUUID(),
    studentUserId,
    planId: normalizedPlan,
    allowance,
    remaining: allowance,
    status: SESSION_PERIOD_STATUS.ACTIVE,
    periodStart: startIso,
    periodEnd: endIso,
    stripeSubscriptionId,
    stripeInvoiceId,
    stripeEventId,
    idempotencyKey: key,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.periods.push(record);
  writeStore(store);
  return mapPeriod(record);
}

/**
 * Grant/reset session credits from a paid Stripe subscription invoice.
 * Exact allowance for the plan; unused prior credits do not roll over.
 */
export async function grantSessionCreditsFromPaidInvoice({
  studentUserId,
  planId,
  invoice,
  subscription,
  stripeEventId = null
}) {
  if (!studentUserId) return null;
  const billingReason = String(invoice?.billing_reason || "").toLowerCase();
  // subscription_update covers paid Plus→Pro upgrades (prorated invoice).
  if (
    billingReason &&
    !["subscription_create", "subscription_cycle", "subscription_update"].includes(billingReason)
  ) {
    return null;
  }
  if (invoice && invoice.status && String(invoice.status).toLowerCase() !== "paid") {
    return null;
  }
  if (billingReason === "subscription_update" && Number(invoice?.amount_paid) === 0) {
    return null;
  }
  if (invoice && Number(invoice.amount_paid) === 0 && billingReason !== "subscription_create") {
    // Do not reset on zero-amount cycle invoices (failed/empty).
    if (billingReason === "subscription_cycle") return null;
  }

  const periodStart =
    invoice?.lines?.data?.[0]?.period?.start ||
    subscription?.current_period_start ||
    invoice?.period_start;
  const periodEnd =
    invoice?.lines?.data?.[0]?.period?.end ||
    subscription?.current_period_end ||
    invoice?.period_end;

  return activateSessionPeriodFromPayment({
    studentUserId,
    planId,
    periodStart,
    periodEnd,
    stripeSubscriptionId: subscription?.id || null,
    stripeInvoiceId: invoice?.id || null,
    stripeEventId,
    idempotencyKey: invoice?.id ? `session-period:invoice:${invoice.id}` : null
  });
}

export async function expireSessionPeriodsAtPeriodEnd(studentUserId, { now = new Date() } = {}) {
  const nowIso = now.toISOString();
  if (canUsePrisma()) {
    try {
      await prismaClient().$executeRawUnsafe(
        `UPDATE subscription_session_periods
         SET status = 'expired', updated_at = NOW()
         WHERE student_user_id = $1::uuid
           AND status = 'active'
           AND period_end <= $2::timestamptz`,
        studentUserId,
        nowIso
      );
      return;
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/subscription_session_periods/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }
  const store = readStore();
  const nowMs = now.getTime();
  for (const period of store.periods) {
    if (period.studentUserId !== studentUserId) continue;
    if (period.status !== SESSION_PERIOD_STATUS.ACTIVE) continue;
    const end = new Date(period.periodEnd).getTime();
    if (!Number.isNaN(end) && end <= nowMs) {
      period.status = SESSION_PERIOD_STATUS.EXPIRED;
      period.updatedAt = nowIso;
    }
  }
  writeStore(store);
}

function noCreditsError() {
  const error = new Error("You have no session credits remaining for the current billing period.");
  error.statusCode = 409;
  error.code = "NO_SESSION_CREDITS";
  return error;
}

/**
 * Reserve exactly 1 session credit for a successful booking request.
 * Idempotent on booking idempotency key.
 */
export async function reserveSubscriptionSessionCredit({
  studentUserId,
  idempotencyKey,
  meetingId = null,
  tx = null
}) {
  if (!studentUserId) throw noCreditsError();
  const key = String(idempotencyKey || "").trim();
  if (!key) {
    const error = new Error("A booking idempotency key is required to reserve a session credit.");
    error.statusCode = 400;
    error.code = "idempotency_key_required";
    throw error;
  }

  await expireSessionPeriodsAtPeriodEnd(studentUserId);

  if (canUsePrisma()) {
    try {
      const client = tx || prismaClient();
      const existing = await client.$queryRawUnsafe(
        `SELECT id, period_id, student_user_id, meeting_id, amount, idempotency_key, created_at
         FROM subscription_session_reservations
         WHERE idempotency_key = $1
         LIMIT 1`,
        key
      );
      if (existing?.[0]) {
        return {
          reserved: true,
          duplicate: true,
          periodId: existing[0].period_id,
          reservationId: existing[0].id
        };
      }

      const periods = await client.$queryRawUnsafe(
        `SELECT id, remaining, status, period_end
         FROM subscription_session_periods
         WHERE student_user_id = $1::uuid
           AND status = 'active'
           AND period_end > NOW()
         ORDER BY period_start DESC
         LIMIT 1
         FOR UPDATE`,
        studentUserId
      );
      const period = periods?.[0];
      if (!period || Number(period.remaining) <= 0) throw noCreditsError();

      const updated = await client.$executeRawUnsafe(
        `UPDATE subscription_session_periods
         SET remaining = remaining - 1, updated_at = NOW()
         WHERE id = $1::uuid
           AND status = 'active'
           AND remaining > 0`,
        period.id
      );
      if (!updated) throw noCreditsError();

      const reservationId = randomUUID();
      await client.$executeRawUnsafe(
        `INSERT INTO subscription_session_reservations
          (id, period_id, student_user_id, meeting_id, amount, idempotency_key, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, -1, $5, NOW())
         ON CONFLICT (idempotency_key) DO NOTHING`,
        reservationId,
        period.id,
        studentUserId,
        meetingId,
        key
      );

      return { reserved: true, duplicate: false, periodId: period.id, reservationId };
    } catch (error) {
      if (error.code === "NO_SESSION_CREDITS" || error.statusCode) throw error;
      if (!isDatabaseUnavailableError(error) && !/subscription_session_/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }

  assertDurableStoreAvailable(process.env, "subscription session periods");
  const store = readStore();
  const prior = store.reservations.find((item) => item.idempotencyKey === key);
  if (prior) {
    return {
      reserved: true,
      duplicate: true,
      periodId: prior.periodId,
      reservationId: prior.id
    };
  }

  const nowMs = Date.now();
  const period = store.periods.find(
    (item) =>
      item.studentUserId === studentUserId &&
      item.status === SESSION_PERIOD_STATUS.ACTIVE &&
      new Date(item.periodEnd).getTime() > nowMs
  );
  if (!period || Number(period.remaining) <= 0) throw noCreditsError();

  period.remaining = Number(period.remaining) - 1;
  period.updatedAt = new Date().toISOString();
  const reservation = {
    id: randomUUID(),
    periodId: period.id,
    studentUserId,
    meetingId,
    amount: -1,
    idempotencyKey: key,
    createdAt: new Date().toISOString()
  };
  store.reservations.push(reservation);
  writeStore(store);
  return { reserved: true, duplicate: false, periodId: period.id, reservationId: reservation.id };
}

export async function attachReservationMeetingId({ idempotencyKey, meetingId }) {
  if (!idempotencyKey || !meetingId) return;
  if (canUsePrisma()) {
    try {
      await prismaClient().$executeRawUnsafe(
        `UPDATE subscription_session_reservations
         SET meeting_id = $2::uuid
         WHERE idempotency_key = $1
           AND (meeting_id IS NULL OR meeting_id = $2::uuid)`,
        idempotencyKey,
        meetingId
      );
      return;
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/subscription_session_reservations/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }
  const store = readStore();
  const reservation = store.reservations.find((item) => item.idempotencyKey === idempotencyKey);
  if (reservation && !reservation.meetingId) {
    reservation.meetingId = meetingId;
    writeStore(store);
  }
}

/** Restore one credit when an unused booking is canceled/declined before acceptance/completion. */
export async function releaseSubscriptionSessionCredit({ meetingId, idempotencyKey = null }) {
  if (!meetingId && !idempotencyKey) return null;

  if (canUsePrisma()) {
    try {
      const rows = await prismaClient().$queryRawUnsafe(
        `SELECT id, period_id, idempotency_key
         FROM subscription_session_reservations
         WHERE ($1::uuid IS NOT NULL AND meeting_id = $1::uuid)
            OR ($2::text IS NOT NULL AND idempotency_key = $2)
         LIMIT 1`,
        meetingId,
        idempotencyKey
      );
      const reservation = rows?.[0];
      if (!reservation) return null;

      const releaseKey = `release:${reservation.idempotency_key}`;
      const priorRelease = await prismaClient().$queryRawUnsafe(
        `SELECT id FROM subscription_session_reservations WHERE idempotency_key = $1 LIMIT 1`,
        releaseKey
      );
      if (priorRelease?.[0]) return { restored: false, duplicate: true };

      await prismaClient().$executeRawUnsafe(
        `UPDATE subscription_session_periods
         SET remaining = LEAST(allowance, remaining + 1), updated_at = NOW()
         WHERE id = $1::uuid
           AND status = 'active'`,
        reservation.period_id
      );
      await prismaClient().$executeRawUnsafe(
        `INSERT INTO subscription_session_reservations
          (id, period_id, student_user_id, meeting_id, amount, idempotency_key, created_at)
         SELECT $1::uuid, period_id, student_user_id, meeting_id, 1, $2, NOW()
         FROM subscription_session_reservations
         WHERE id = $3::uuid
         ON CONFLICT (idempotency_key) DO NOTHING`,
        randomUUID(),
        releaseKey,
        reservation.id
      );
      return { restored: true, duplicate: false };
    } catch (error) {
      if (!isDatabaseUnavailableError(error) && !/subscription_session_/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
  }

  assertDurableStoreAvailable(process.env, "subscription session periods");
  const store = readStore();
  const reservation = store.reservations.find(
    (item) =>
      (meetingId && item.meetingId === meetingId) ||
      (idempotencyKey && item.idempotencyKey === idempotencyKey)
  );
  if (!reservation || reservation.amount >= 0) return null;
  const releaseKey = `release:${reservation.idempotencyKey}`;
  if (store.reservations.some((item) => item.idempotencyKey === releaseKey)) {
    return { restored: false, duplicate: true };
  }
  const period = store.periods.find((item) => item.id === reservation.periodId);
  if (period && period.status === SESSION_PERIOD_STATUS.ACTIVE) {
    period.remaining = Math.min(period.allowance, Number(period.remaining) + 1);
    period.updatedAt = new Date().toISOString();
  }
  store.reservations.push({
    id: randomUUID(),
    periodId: reservation.periodId,
    studentUserId: reservation.studentUserId,
    meetingId: reservation.meetingId,
    amount: 1,
    idempotencyKey: releaseKey,
    createdAt: new Date().toISOString()
  });
  writeStore(store);
  return { restored: true, duplicate: false };
}
