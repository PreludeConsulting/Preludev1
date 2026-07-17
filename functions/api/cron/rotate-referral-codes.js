/**
 * Cloudflare Pages Function for monthly referral rotation.
 * Auth: Authorization Bearer CRON_SECRET or x-cron-secret.
 */
import { createSupabaseAdmin } from "../../../server/lib/supabasePasswordReset.js";
import {
  REFERRAL_BUSINESS_TIMEZONE,
  formatReferralMonthLabel,
  logReferralEvent,
  referralMonthParts
} from "../../../shared/referralConstants.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function envFromContext(context) {
  return {
    ...context.env,
    SUPABASE_URL: context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: context.env?.SUPABASE_SERVICE_ROLE_KEY
  };
}

function timingSafeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorize(context) {
  const expected = String(context.env?.CRON_SECRET || context.env?.REFERRAL_ROTATION_SECRET || "").trim();
  if (!expected || expected.length < 16) {
    const error = new Error("CRON_SECRET is not configured.");
    error.statusCode = 503;
    throw error;
  }
  const bearer = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const headerSecret = context.request.headers.get("x-cron-secret")?.trim() || "";
  if (!timingSafeEqual(bearer || headerSecret, expected)) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    throw error;
  }
}

function resolveMonth(raw) {
  if (!raw) return referralMonthParts().validMonthDate;
  const match = String(raw).trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) {
    const error = new Error("Month must be YYYY-MM or YYYY-MM-01.");
    error.statusCode = 400;
    throw error;
  }
  return `${match[1]}-${match[2]}-01`;
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-cron-secret"
      }
    });
  }
  if (context.request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    authorize(context);
    const env = envFromContext(context);
    const supabase = createSupabaseAdmin(env);
    if (!supabase) return json({ error: "server_error", message: "Supabase is not configured." }, 503);

    let payload = {};
    try {
      payload = await context.request.json();
    } catch {
      payload = {};
    }

    const validMonthDate = resolveMonth(payload.month);
    const batchSize = Math.min(1000, Math.max(1, Number(payload.batchSize) || 200));
    const sendNotifications = payload.sendNotifications !== false;

    let afterHouseholdId = null;
    let hasMore = true;
    const totals = {
      ok: true,
      timezone: REFERRAL_BUSINESS_TIMEZONE,
      validMonth: validMonthDate.slice(0, 7),
      monthLabel: formatReferralMonthLabel(validMonthDate),
      processed: 0,
      rotated: 0,
      skipped: 0,
      failed: 0,
      notificationsCreated: 0,
      batches: 0
    };

    while (hasMore && totals.batches < 10_000) {
      const { data, error } = await supabase.rpc("rotate_referral_codes_for_month", {
        p_valid_month: validMonthDate,
        p_batch_size: batchSize,
        p_after_household_id: afterHouseholdId,
        p_send_notifications: sendNotifications
      });
      if (error) throw error;
      totals.batches += 1;
      totals.processed += data?.processed || 0;
      totals.rotated += data?.rotated || 0;
      totals.skipped += data?.skipped || 0;
      totals.failed += data?.failed || 0;
      totals.notificationsCreated += data?.notificationsCreated || 0;
      hasMore = Boolean(data?.hasMore);
      afterHouseholdId = data?.lastHouseholdId || null;
      if (!afterHouseholdId) hasMore = false;
    }

    logReferralEvent("referral_rotation_completed", {
      validMonth: totals.validMonth,
      processed: totals.processed,
      rotated: totals.rotated,
      skipped: totals.skipped,
      failed: totals.failed,
      notificationsCreated: totals.notificationsCreated,
      batches: totals.batches,
      runtime: "cloudflare"
    });

    return json(totals);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error("[prelude-referral-rotation]", error);
    return json(
      {
        error: status === 401 ? "unauthorized" : "server_error",
        message: error.message || "Referral rotation failed."
      },
      status
    );
  }
}
