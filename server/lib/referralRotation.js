/**
 * Monthly referral-code rotation orchestration.
 * Stable ownership stays on households; codes are rotating lookup values.
 */
import {
  REFERRAL_BUSINESS_TIMEZONE,
  formatReferralMonthLabel,
  logReferralEvent,
  referralMonthParts
} from "../../shared/referralConstants.js";
import { getSupabaseAdmin } from "./supabaseRequestAuth.js";

function admin() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const error = new Error("Supabase admin client is not configured.");
    error.code = "server_error";
    error.statusCode = 503;
    throw error;
  }
  return supabase;
}

/**
 * Normalize a month argument to an ISO date string (YYYY-MM-01) for SQL.
 * Accepts Date, "YYYY-MM", "YYYY-MM-DD", or null (current business month).
 */
export function resolveRotationMonth(monthInput = null, at = new Date()) {
  if (!monthInput) {
    return referralMonthParts(at).validMonthDate;
  }
  if (monthInput instanceof Date) {
    return referralMonthParts(monthInput).validMonthDate;
  }
  const raw = String(monthInput).trim();
  const match = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) {
    const error = new Error("Month must be YYYY-MM or YYYY-MM-01.");
    error.code = "invalid_month";
    error.statusCode = 400;
    throw error;
  }
  return `${match[1]}-${match[2]}-01`;
}

export function isFirstDayOfReferralMonth(at = new Date(), timeZone = REFERRAL_BUSINESS_TIMEZONE) {
  return referralMonthParts(at, timeZone).day === 1;
}

/**
 * Run one batch of monthly rotations. Safe to call repeatedly (idempotent).
 */
export async function rotateReferralCodesBatch({
  month = null,
  batchSize = 200,
  afterHouseholdId = null,
  sendNotifications = true
} = {}) {
  const supabase = admin();
  const validMonthDate = resolveRotationMonth(month);
  const started = Date.now();

  const { data, error } = await supabase.rpc("rotate_referral_codes_for_month", {
    p_valid_month: validMonthDate,
    p_batch_size: batchSize,
    p_after_household_id: afterHouseholdId,
    p_send_notifications: sendNotifications
  });

  if (error) {
    logReferralEvent("referral_rotation_batch_failed", {
      validMonth: validMonthDate,
      error: error.message
    });
    throw error;
  }

  const summary = {
    timezone: REFERRAL_BUSINESS_TIMEZONE,
    monthLabel: formatReferralMonthLabel(validMonthDate),
    durationMs: Date.now() - started,
    ...(data || {})
  };

  logReferralEvent("referral_rotation_batch", {
    validMonth: summary.validMonth || validMonthDate.slice(0, 7),
    processed: summary.processed || 0,
    rotated: summary.rotated || 0,
    skipped: summary.skipped || 0,
    failed: summary.failed || 0,
    notificationsCreated: summary.notificationsCreated || 0,
    hasMore: Boolean(summary.hasMore),
    durationMs: summary.durationMs
  });

  return summary;
}

/**
 * Drain all households for a month (admin / cron). Idempotent across retries.
 */
export async function rotateAllReferralCodesForMonth({
  month = null,
  batchSize = 200,
  sendNotifications = true,
  maxBatches = 10_000
} = {}) {
  const validMonthDate = resolveRotationMonth(month);
  let afterHouseholdId = null;
  let batches = 0;
  const totals = {
    timezone: REFERRAL_BUSINESS_TIMEZONE,
    validMonth: validMonthDate.slice(0, 7),
    monthLabel: formatReferralMonthLabel(validMonthDate),
    processed: 0,
    rotated: 0,
    skipped: 0,
    failed: 0,
    notificationsCreated: 0,
    batches: 0,
    runIds: [],
    errors: []
  };

  while (batches < maxBatches) {
    const batch = await rotateReferralCodesBatch({
      month: validMonthDate,
      batchSize,
      afterHouseholdId,
      sendNotifications
    });
    batches += 1;
    totals.batches = batches;
    totals.processed += batch.processed || 0;
    totals.rotated += batch.rotated || 0;
    totals.skipped += batch.skipped || 0;
    totals.failed += batch.failed || 0;
    totals.notificationsCreated += batch.notificationsCreated || 0;
    if (batch.runId) totals.runIds.push(batch.runId);
    if (Array.isArray(batch.errors) && batch.errors.length) {
      totals.errors.push(...batch.errors);
    }
    if (!batch.hasMore) break;
    afterHouseholdId = batch.lastHouseholdId || null;
    if (!afterHouseholdId) break;
  }

  logReferralEvent("referral_rotation_completed", {
    validMonth: totals.validMonth,
    processed: totals.processed,
    rotated: totals.rotated,
    skipped: totals.skipped,
    failed: totals.failed,
    notificationsCreated: totals.notificationsCreated,
    batches: totals.batches
  });

  return totals;
}

/**
 * Cron entrypoint: rotate for the current ET month.
 * On the 1st this creates new codes; later in the month it only backfills missing rows.
 */
export async function runMonthlyReferralCodeRotationJob(options = {}) {
  const at = options.at || new Date();
  const parts = referralMonthParts(at);
  return rotateAllReferralCodesForMonth({
    month: parts.validMonthDate,
    batchSize: options.batchSize || 200,
    sendNotifications: options.sendNotifications !== false,
    maxBatches: options.maxBatches || 10_000
  });
}
