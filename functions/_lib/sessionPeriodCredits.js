/**
 * Cloudflare Workers helpers for Plus/Pro session-period ledger rows.
 * Mirrors server/lib/sessionCredits ensure + invoice grant semantics via Supabase REST.
 *
 * Pass either:
 * - stripeBilling `supabaseRest` (object body + `prefer` field), or
 * - `wrapAdminRestForSessionPeriods(adminRest)` from http.js
 */

import { getMonthlyOneOnOneLimit, normalizePlanId } from "../../shared/mentorAccess.js";
import {
  getConfiguredSessionAllowance,
  sessionPeriodEnsureIdempotencyKey,
  shouldInitializeSessionPeriodForSubscription
} from "../../shared/sessionPeriodEnsure.js";
import {
  resolveInvoiceSubscriptionPeriodBounds,
  unixToIso
} from "../../shared/stripeSubscriptionPeriod.js";

function first(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Adapt http.js adminRest to the stripeBilling supabaseRest calling style. */
export function wrapAdminRestForSessionPeriods(adminRest) {
  return async (context, path, { method = "GET", body = null, prefer = "return=representation" } = {}) =>
    adminRest(context, path, {
      method,
      ...(body != null ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
      headers: { Prefer: prefer }
    });
}

export function summarizeSessionPeriodRow(period) {
  if (!period) {
    return { allowance: 0, remaining: 0, used: 0, active: false, periodEnd: null, planId: null };
  }
  const allowance = Math.max(0, Number(period.allowance) || 0);
  const remaining = Math.max(0, Number(period.remaining) || 0);
  return {
    allowance,
    remaining,
    used: Math.max(0, allowance - remaining),
    active: String(period.status || "").toLowerCase() === "active",
    periodEnd: period.period_end || null,
    planId: period.plan_id || null
  };
}

async function findActivePeriod(supabaseRest, context, studentUserId) {
  const nowIso = new Date().toISOString();
  const rows = await supabaseRest(
    context,
    `subscription_session_periods?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&period_end=gt.${encodeURIComponent(nowIso)}&select=*&order=period_start.desc&limit=1`,
    { method: "GET", prefer: "return=representation" }
  );
  return first(rows);
}

async function findByIdempotencyKey(supabaseRest, context, key) {
  const rows = await supabaseRest(
    context,
    `subscription_session_periods?idempotency_key=eq.${encodeURIComponent(key)}&select=*&limit=1`,
    { method: "GET", prefer: "return=representation" }
  );
  return first(rows);
}

async function supersedeOtherActivePeriods(supabaseRest, context, studentUserId, keepId) {
  const rows = await supabaseRest(
    context,
    `subscription_session_periods?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&select=id`,
    { method: "GET", prefer: "return=representation" }
  );
  for (const row of rows || []) {
    if (!row?.id || row.id === keepId) continue;
    await supabaseRest(
      context,
      `subscription_session_periods?id=eq.${encodeURIComponent(row.id)}`,
      {
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: "superseded", updated_at: new Date().toISOString() }
      }
    );
  }
}

/**
 * Open period #1 for an active Plus/Pro membership when no ledger row exists.
 */
export async function ensureSessionPeriodRow(supabaseRest, context, {
  studentUserId,
  planId,
  periodStart,
  periodEnd,
  stripeSubscriptionId = null
}) {
  const normalizedPlan = normalizePlanId(planId);
  const allowance = getConfiguredSessionAllowance(normalizedPlan);
  if (!studentUserId || !allowance || !periodStart || !periodEnd) return null;
  if (new Date(periodEnd).getTime() <= Date.now()) return null;

  const existing = await findActivePeriod(supabaseRest, context, studentUserId);
  if (existing) return existing;

  if (
    !shouldInitializeSessionPeriodForSubscription({
      subscriptionStatus: "active",
      planId: normalizedPlan,
      periodStartIso: periodStart,
      periodEndIso: periodEnd
    })
  ) {
    return null;
  }

  const idempotencyKey = sessionPeriodEnsureIdempotencyKey({
    studentUserId,
    periodStartIso: periodStart,
    periodEndIso: periodEnd,
    stripeSubscriptionId
  });
  const prior = await findByIdempotencyKey(supabaseRest, context, idempotencyKey);
  if (prior) return prior;

  await supabaseRest(context, "subscription_session_periods", {
    method: "POST",
    prefer: "return=minimal,resolution=ignore-duplicates",
    body: {
      student_user_id: studentUserId,
      plan_id: normalizedPlan,
      allowance,
      remaining: allowance,
      status: "active",
      period_start: periodStart,
      period_end: periodEnd,
      stripe_subscription_id: stripeSubscriptionId,
      idempotency_key: idempotencyKey
    }
  });

  return (
    (await findByIdempotencyKey(supabaseRest, context, idempotencyKey)) ||
    (await findActivePeriod(supabaseRest, context, studentUserId))
  );
}

/**
 * Heal missing period #1 from profile Stripe period fields (read-path).
 */
export async function ensureSessionPeriodFromProfile(supabaseRest, context, profile) {
  if (!profile?.id) return null;
  const planId = normalizePlanId(profile.plan_id || profile.plan);
  const status = String(profile.subscription_status || "").trim().toLowerCase();
  const periodStart =
    profile.subscription_current_period_start || profile.subscriptionCurrentPeriodStart || null;
  const periodEnd =
    profile.subscription_current_period_end ||
    profile.entitlement_ends_at ||
    profile.subscriptionCurrentPeriodEnd ||
    null;
  if (
    !shouldInitializeSessionPeriodForSubscription({
      subscriptionStatus: status === "complete" || status === "checkout_completed" ? "active" : status,
      planId,
      periodStartIso: periodStart,
      periodEndIso: periodEnd
    })
  ) {
    return null;
  }
  return ensureSessionPeriodRow(supabaseRest, context, {
    studentUserId: profile.id,
    planId,
    periodStart,
    periodEnd,
    stripeSubscriptionId: profile.stripe_subscription_id || profile.stripeSubscriptionId || null
  });
}

/**
 * Grant/reset from a paid invoice. Idempotent on invoice id. Supersedes only after the
 * period row exists so a failed insert cannot wipe an earlier ensure row.
 */
export async function grantSessionPeriodFromPaidInvoice(supabaseRest, context, {
  studentUserId,
  planId,
  invoice,
  subscription,
  stripeEventId = null
}) {
  if (!studentUserId || !invoice?.id) return null;
  const billingReason = String(invoice.billing_reason || "").toLowerCase();
  const amountPaid = Number(invoice.amount_paid);
  const shouldGrant =
    !billingReason ||
    billingReason === "subscription_create" ||
    billingReason === "subscription_cycle" ||
    (billingReason === "subscription_update" && amountPaid > 0);
  const zeroCycle = amountPaid === 0 && billingReason === "subscription_cycle";
  if (!shouldGrant || zeroCycle) return null;
  if (invoice.status && String(invoice.status).toLowerCase() !== "paid" && invoice.paid !== true) {
    return null;
  }

  const bounds = resolveInvoiceSubscriptionPeriodBounds(invoice, subscription);
  const startIso = unixToIso(bounds.startUnix);
  const endIso = unixToIso(bounds.endUnix);
  if (!startIso || !endIso) {
    console.error("[stripe-billing] session credit grant skipped: missing period bounds", {
      invoiceId: invoice.id,
      subscriptionId: subscription?.id
    });
    return null;
  }

  const normalizedPlan = normalizePlanId(planId);
  const allowance = getMonthlyOneOnOneLimit(normalizedPlan);
  if (!allowance) return null;

  const idempotencyKey = `session-period:invoice:${invoice.id}`;
  const existing = await findByIdempotencyKey(supabaseRest, context, idempotencyKey);
  if (existing) return existing;

  await supabaseRest(context, "subscription_session_periods", {
    method: "POST",
    prefer: "return=minimal,resolution=ignore-duplicates",
    body: {
      student_user_id: studentUserId,
      plan_id: normalizedPlan,
      allowance,
      remaining: allowance,
      status: "active",
      period_start: startIso,
      period_end: endIso,
      stripe_subscription_id: subscription?.id || null,
      stripe_invoice_id: invoice.id,
      stripe_event_id: stripeEventId,
      idempotency_key: idempotencyKey
    }
  });

  const created = await findByIdempotencyKey(supabaseRest, context, idempotencyKey);
  if (created?.id) {
    await supersedeOtherActivePeriods(supabaseRest, context, studentUserId, created.id);
  }
  return created;
}

function randomUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Reserve exactly 1 session credit for a Book a Session request (Workers / REST).
 * Idempotent on booking idempotency key.
 */
export async function reserveSessionCreditRow(supabaseRest, context, {
  studentUserId,
  idempotencyKey,
  meetingId = null
}) {
  if (!studentUserId) {
    const error = new Error("You have no session credits remaining for the current billing period.");
    error.statusCode = 409;
    error.code = "NO_SESSION_CREDITS";
    throw error;
  }
  const key = String(idempotencyKey || "").trim();
  if (!key) {
    const error = new Error("A booking idempotency key is required to reserve a session credit.");
    error.statusCode = 400;
    error.code = "idempotency_key_required";
    throw error;
  }

  const existing = first(
    await supabaseRest(
      context,
      `subscription_session_reservations?idempotency_key=eq.${encodeURIComponent(key)}&select=id,period_id&limit=1`,
      { method: "GET", prefer: "return=representation" }
    )
  );
  if (existing?.id) {
    return {
      reserved: true,
      duplicate: true,
      periodId: existing.period_id,
      reservationId: existing.id
    };
  }

  const nowIso = new Date().toISOString();
  const period = first(
    await supabaseRest(
      context,
      `subscription_session_periods?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&period_end=gt.${encodeURIComponent(nowIso)}&remaining=gt.0&select=id,remaining,allowance&order=period_start.desc&limit=1`,
      { method: "GET", prefer: "return=representation" }
    )
  );
  if (!period?.id || Number(period.remaining) <= 0) {
    const error = new Error("You have no session credits remaining for the current billing period.");
    error.statusCode = 409;
    error.code = "NO_SESSION_CREDITS";
    throw error;
  }

  const nextRemaining = Number(period.remaining) - 1;
  const updated = await supabaseRest(
    context,
    `subscription_session_periods?id=eq.${encodeURIComponent(period.id)}&status=eq.active&remaining=eq.${encodeURIComponent(String(period.remaining))}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        remaining: nextRemaining,
        updated_at: new Date().toISOString()
      }
    }
  );
  if (!first(updated)?.id) {
    const error = new Error("You have no session credits remaining for the current billing period.");
    error.statusCode = 409;
    error.code = "NO_SESSION_CREDITS";
    throw error;
  }

  const reservationId = randomUuid();
  try {
    await supabaseRest(context, "subscription_session_reservations", {
      method: "POST",
      prefer: "return=minimal,resolution=ignore-duplicates",
      body: {
        id: reservationId,
        period_id: period.id,
        student_user_id: studentUserId,
        meeting_id: meetingId,
        amount: -1,
        idempotency_key: key
      }
    });
  } catch (error) {
    // Roll back the decrement if reservation insert fails (non-duplicate).
    const message = String(error?.message || "");
    if (!/duplicate|unique|23505/i.test(message)) {
      await supabaseRest(
        context,
        `subscription_session_periods?id=eq.${encodeURIComponent(period.id)}`,
        {
          method: "PATCH",
          prefer: "return=minimal",
          body: {
            remaining: Number(period.remaining),
            updated_at: new Date().toISOString()
          }
        }
      ).catch(() => {});
      throw error;
    }
  }

  return { reserved: true, duplicate: false, periodId: period.id, reservationId };
}

export async function attachSessionCreditMeetingId(supabaseRest, context, {
  idempotencyKey,
  meetingId
}) {
  if (!idempotencyKey || !meetingId) return;
  await supabaseRest(
    context,
    `subscription_session_reservations?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&or=(meeting_id.is.null,meeting_id.eq.${encodeURIComponent(meetingId)})`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { meeting_id: meetingId }
    }
  );
}

/** Restore one credit when a pending request is canceled/declined unused. */
export async function releaseSessionCreditRow(supabaseRest, context, {
  meetingId = null,
  idempotencyKey = null
}) {
  if (!meetingId && !idempotencyKey) return null;
  const filters = [];
  if (meetingId) filters.push(`meeting_id=eq.${encodeURIComponent(meetingId)}`);
  if (idempotencyKey) filters.push(`idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`);
  const reservation = first(
    await supabaseRest(
      context,
      `subscription_session_reservations?or=(${filters.join(",")})&amount=eq.-1&select=id,period_id,student_user_id,meeting_id,idempotency_key&limit=1`,
      { method: "GET", prefer: "return=representation" }
    )
  );
  if (!reservation?.id) return null;

  const releaseKey = `release:${reservation.idempotency_key}`;
  const priorRelease = first(
    await supabaseRest(
      context,
      `subscription_session_reservations?idempotency_key=eq.${encodeURIComponent(releaseKey)}&select=id&limit=1`,
      { method: "GET", prefer: "return=representation" }
    )
  );
  if (priorRelease?.id) return { restored: false, duplicate: true };

  const period = first(
    await supabaseRest(
      context,
      `subscription_session_periods?id=eq.${encodeURIComponent(reservation.period_id)}&select=id,allowance,remaining,status&limit=1`,
      { method: "GET", prefer: "return=representation" }
    )
  );
  if (period?.id && String(period.status).toLowerCase() === "active") {
    const next = Math.min(Number(period.allowance) || 0, (Number(period.remaining) || 0) + 1);
    await supabaseRest(
      context,
      `subscription_session_periods?id=eq.${encodeURIComponent(period.id)}`,
      {
        method: "PATCH",
        prefer: "return=minimal",
        body: { remaining: next, updated_at: new Date().toISOString() }
      }
    );
  }

  await supabaseRest(context, "subscription_session_reservations", {
    method: "POST",
    prefer: "return=minimal,resolution=ignore-duplicates",
    body: {
      id: randomUuid(),
      period_id: reservation.period_id,
      student_user_id: reservation.student_user_id,
      meeting_id: reservation.meeting_id,
      amount: 1,
      idempotency_key: releaseKey
    }
  });
  return { restored: true, duplicate: false };
}
