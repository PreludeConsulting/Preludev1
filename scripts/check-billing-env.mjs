#!/usr/bin/env node
/**
 * Reports which Stripe / billing env vars are ready (never prints secret values).
 * Usage: node scripts/check-billing-env.mjs
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { REQUIRED_STRIPE_PRICE_ENV_KEYS } from "../shared/billingCatalog.js";
import { getBillingConfig } from "../server/billingConfig.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function present(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  if (/^(replace|your[-_]?|placeholder|xxx|change.?me|disabled)/i.test(v)) return false;
  if (v === "https://your-project.supabase.co") return false;
  if (v === "your-service-role-key") return false;
  return true;
}

function classify(key, value) {
  const v = String(value || "").trim();
  if (!present(v)) return { ok: false, note: "missing" };
  if (/SECRET|KEY|ROLE|TOKEN|PASSWORD|CRON/i.test(key)) {
    const kind = v.startsWith("sk_test")
      ? "sk_test"
      : v.startsWith("sk_live")
        ? "sk_live"
        : v.startsWith("pk_test")
          ? "pk_test"
          : v.startsWith("pk_live")
            ? "pk_live"
            : v.startsWith("whsec_")
              ? "whsec"
              : v.startsWith("price_")
                ? "price"
                : "set";
    return { ok: true, note: `${kind} (len=${v.length})` };
  }
  return { ok: true, note: v.length > 48 ? `${v.slice(0, 48)}…` : v };
}

const required = [
  "BILLING_PROVIDER",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
  "PUBLIC_APP_URL",
  ...REQUIRED_STRIPE_PRICE_ENV_KEYS
];

const optional = ["STRIPE_REFERRAL_COUPON_ID", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VITE_PUBLIC_APP_URL"];

console.log("Billing env check\n");

let missing = 0;
for (const key of required) {
  const { ok, note } = classify(key, process.env[key]);
  if (!ok) missing += 1;
  console.log(`${ok ? "✓" : "✗"} ${key}: ${note}`);
}

console.log("\nOptional / related\n");
for (const key of optional) {
  const { ok, note } = classify(key, process.env[key]);
  console.log(`${ok ? "✓" : "·"} ${key}: ${note}`);
}

const config = getBillingConfig(process.env);
console.log("\nResolved billing config");
console.log(`  provider: ${config.provider}`);
console.log(`  enabled: ${config.enabled}`);
console.log(`  webhookEnabled: ${config.webhookEnabled}`);
if (config.missing?.length) {
  console.log(`  missing for enable: ${config.missing.join(", ")}`);
}

if (missing) {
  console.log(`\n${missing} required value(s) still missing.`);
  console.log("Dashboard-only steps remaining:");
  console.log("  1. Paste STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from Stripe → Developers → API keys");
  console.log("  2. Run: npm run stripe:catalog -- --write-env");
  console.log("  3. Run: npm run stripe:webhook  (copy whsec_… into STRIPE_WEBHOOK_SECRET)");
  console.log("  4. Set BILLING_PROVIDER=stripe and restart the app");
  process.exitCode = 1;
} else {
  console.log("\nAll required billing env vars look present.");
}
