/**
 * Secure cron / admin endpoint for monthly referral-code rotation.
 * Auth: Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
import { z } from "zod";
import { readJsonBody, sendJson, getRequestUrl } from "./http.js";
import {
  isFirstDayOfReferralMonth,
  resolveRotationMonth,
  rotateAllReferralCodesForMonth,
  runMonthlyReferralCodeRotationJob
} from "./lib/referralRotation.js";
import { logReferralEvent, REFERRAL_BUSINESS_TIMEZONE } from "../shared/referralConstants.js";

function getCronSecret(env = process.env) {
  return String(env.CRON_SECRET || env.REFERRAL_ROTATION_SECRET || "").trim();
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left[i] ^ right[i];
  }
  return mismatch === 0;
}

export function authorizeCronRequest(req, env = process.env) {
  const expected = getCronSecret(env);
  if (!expected || expected.length < 16) {
    const error = new Error("CRON_SECRET is not configured.");
    error.statusCode = 503;
    error.code = "cron_not_configured";
    throw error;
  }
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const headerSecret = String(req.headers["x-cron-secret"] || "").trim();
  const provided = bearer || headerSecret;
  if (!provided || !timingSafeEqual(provided, expected)) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    error.code = "unauthorized";
    throw error;
  }
}

const bodySchema = z
  .object({
    month: z.string().trim().regex(/^\d{4}-\d{2}(-\d{2})?$/).optional(),
    batchSize: z.number().int().min(1).max(1000).optional(),
    sendNotifications: z.boolean().optional(),
    force: z.boolean().optional()
  })
  .optional();

function referralCronPaths(pathname) {
  return (
    pathname === "/api/cron/rotate-referral-codes" ||
    pathname === "/api/admin/referral/rotate-codes"
  );
}

async function handleRotation(req, res, env) {
  authorizeCronRequest(req, env);
  const payload = bodySchema.parse((await readJsonBody(req).catch(() => ({}))) || {});
  const force = Boolean(payload?.force);
  const month = payload?.month ? resolveRotationMonth(payload.month) : null;

  if (!force && !month && !isFirstDayOfReferralMonth()) {
    // Still safe to backfill mid-month, but cron schedule should hit day 1.
    // Allow without force so missed runs can heal; log for observability.
    logReferralEvent("referral_rotation_mid_month_run", {
      timezone: REFERRAL_BUSINESS_TIMEZONE
    });
  }

  const result = month
    ? await rotateAllReferralCodesForMonth({
        month,
        batchSize: payload?.batchSize || 200,
        sendNotifications: payload?.sendNotifications !== false
      })
    : await runMonthlyReferralCodeRotationJob({
        batchSize: payload?.batchSize || 200,
        sendNotifications: payload?.sendNotifications !== false
      });

  return sendJson(res, 200, { ok: true, ...result });
}

export function createReferralRotationApiMiddleware(env = process.env) {
  return async function referralRotationApiMiddleware(req, res, next) {
    const url = getRequestUrl(req);
    if (!referralCronPaths(url.pathname)) return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-cron-secret");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    try {
      return await handleRotation(req, res, env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      }
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-referral-rotation]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Referral rotation failed."
      });
    }
  };
}

const middleware = createReferralRotationApiMiddleware();
export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
