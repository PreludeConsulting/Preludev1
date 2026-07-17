#!/usr/bin/env node
/**
 * Admin-safe monthly referral-code rotation.
 *
 * Usage:
 *   node scripts/rotate-referral-codes.mjs
 *   node scripts/rotate-referral-codes.mjs --month 2026-08
 *   node scripts/rotate-referral-codes.mjs --month 2026-08 --no-notify
 *   node scripts/rotate-referral-codes.mjs --batch-size 100
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL).
 * Idempotent: safe to re-run for the same month.
 */
import "dotenv/config";
import {
  rotateAllReferralCodesForMonth,
  resolveRotationMonth
} from "../server/lib/referralRotation.js";
import { REFERRAL_BUSINESS_TIMEZONE, formatReferralMonthLabel } from "../shared/referralConstants.js";

function parseArgs(argv) {
  const out = { month: null, batchSize: 200, sendNotifications: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--month" && argv[i + 1]) {
      out.month = argv[++i];
    } else if (arg === "--batch-size" && argv[i + 1]) {
      out.batchSize = Number(argv[++i]);
    } else if (arg === "--no-notify") {
      out.sendNotifications = false;
    } else if (arg === "--help" || arg === "-h") {
      out.help = true;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Rotate referral codes for a calendar month (${REFERRAL_BUSINESS_TIMEZONE}).

Options:
  --month YYYY-MM     Target month (default: current ET month)
  --batch-size N      Households per RPC batch (default: 200)
  --no-notify         Skip in-app notifications
`);
    process.exit(0);
  }

  const month = resolveRotationMonth(args.month);
  console.log(
    JSON.stringify({
      event: "referral_rotation_cli_start",
      month: formatReferralMonthLabel(month),
      validMonth: month,
      timezone: REFERRAL_BUSINESS_TIMEZONE,
      batchSize: args.batchSize,
      sendNotifications: args.sendNotifications
    })
  );

  const result = await rotateAllReferralCodesForMonth({
    month,
    batchSize: args.batchSize,
    sendNotifications: args.sendNotifications
  });

  console.log(JSON.stringify({ event: "referral_rotation_cli_done", ...result }, null, 2));
  if (result.failed > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "referral_rotation_cli_failed", error: error.message }));
  process.exit(1);
});
