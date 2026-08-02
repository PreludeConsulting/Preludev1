#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { databaseUrl, loadDotEnv } from "./db-utils.mjs";

loadDotEnv();

const RETIRED_CODES = [
  "BASIC-FREE-7K2M",
  "WELCOME-9Q4X",
  "START-BASIC-6N8P",
  "ACCESS-4T7R",
  "JOIN-FREE-8M3K",
  "BASIC-GIFT-5X9D",
  "LAUNCH-2P7V",
  "NEWUSER-8R4C",
  "FREEPASS-6J3N",
  "BASIC-1W9Q",
  "EARLY-ACCESS-7F2K",
  "ACCOUNT-GIFT-4M8Z",
  "BASIC-PLUSZERO-9C5T",
  "WELCOME-GIFT-3H7P",
  "STARTER-FREE-8V2N",
  "BASIC-ACCESS-5Q4J",
  "JOIN-NOW-7Z6M",
  "PROMO-BASIC-2K9R",
  "FREE-BASIC-4N8X",
  "APP-ACCESS-6T3W"
];

const SAMPLE_CODES = [
  "PLUS-FREE-9K4M",
  "WELCOME-PLUS-3Q8X",
  "START-PLUS-7N2P",
  "ACCESS-PLUS-5T6R",
  "JOIN-PLUS-4M8K",
  "PLUS-GIFT-2X9D",
  "LAUNCH-PLUS-6P7V",
  "NEWUSER-PLUS-8R3C",
  "FREEPASS-PLUS-1J5N",
  "PLUS-ACCESS-9W2Q",
  "EARLY-PLUS-7F4K",
  "ACCOUNT-PLUS-3M6Z",
  "PLUS-ZERO-8C5T",
  "WELCOME-PLUS-4H7P",
  "STARTER-PLUS-6V8N",
  "PLUS-NOW-5Q3J",
  "JOIN-PLUS-9Z7M",
  "PROMO-PLUS-2K6R",
  "FREE-PLUS-4N8X",
  "APP-PLUS-7T3W"
];

const CAMPAIGN_NAME = "Launch Complimentary Plus";

const PRO_MONTH_CODES = [
  "PRO-MONTH-8K2N",
  "PRO-MONTH-4Q7X",
  "PRO-MONTH-9M3P",
  "PRO-MONTH-2T6R",
  "PRO-MONTH-5J8K",
  "PRO-MONTH-7X1D",
  "PRO-MONTH-3P9V",
  "PRO-MONTH-6R4C",
  "PRO-MONTH-1W8N",
  "PRO-MONTH-9F2Q",
  "PRO-MONTH-4H7K",
  "PRO-MONTH-8C5Z",
  "PRO-MONTH-2V6T",
  "PRO-MONTH-5N3J",
  "PRO-MONTH-7Z9M"
];

const PRO_MONTH_CAMPAIGN = "Complimentary Pro Month";

const PRO_CODE = {
  public_code: "PRO-FREE-7K9M",
  code_hash: "0290fc5322c57f773fd87d68b157f15b3933b7b67d1b7b5c89b4ad180b633d2b",
  description: "Single-use complimentary Pro Plan code",
  campaign_name: "Complimentary Pro",
  applicable_plan: "pro",
  discount_type: "complimentary",
  single_use: true,
  max_redemptions: 1,
  max_redemptions_per_user: 1,
  active: true,
  new_users_only: true,
  access_duration_days: null,
  renewal_behavior: "requires_payment",
  internal_notes: "One-time free Pro account. Deactivated after first redemption."
};

function hashCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

function buildPlusRows() {
  return SAMPLE_CODES.map((publicCode, index) => ({
    public_code: publicCode,
    code_hash: hashCode(publicCode),
    description: `Single-use complimentary Plus Plan code ${index + 1}`,
    campaign_name: CAMPAIGN_NAME,
    applicable_plan: "plus",
    discount_type: "complimentary",
    single_use: true,
    max_redemptions: 1,
    active: true,
    new_users_only: true,
    access_duration_days: null,
    renewal_behavior: "requires_payment"
  }));
}

function buildProMonthRows() {
  return PRO_MONTH_CODES.map((publicCode, index) => ({
    public_code: publicCode,
    code_hash: hashCode(publicCode),
    description: `Single-use 1-month complimentary Pro Plan code ${index + 1}`,
    campaign_name: PRO_MONTH_CAMPAIGN,
    applicable_plan: "pro",
    discount_type: "complimentary",
    single_use: true,
    max_redemptions: 1,
    max_redemptions_per_user: 1,
    active: true,
    new_users_only: true,
    access_duration_days: 30,
    renewal_behavior: "requires_payment",
    internal_notes:
      "One free month of Pro. Deactivated after first redemption; payment required after access ends."
  }));
}

function buildProRow() {
  return { ...PRO_CODE };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, key };
}

function isUsableSupabaseConfig({ url, key }) {
  if (!url || !key) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host || host === "your-project.supabase.co" || host.includes("example")) return false;
  } catch {
    return false;
  }
  return true;
}

async function retireOldCodesSupabase(supabase) {
  const { error } = await supabase
    .from("promo_codes")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .in("public_code", RETIRED_CODES);
  if (error) throw error;
  console.log(`Retired ${RETIRED_CODES.length} legacy Basic promo codes.`);
}

async function upsertPromoRowsSupabase(supabase, rows, label) {
  const hashes = rows.map((row) => row.code_hash);
  const { data: existingRows, error: lookupError } = await supabase
    .from("promo_codes")
    .select("code_hash, current_redemption_count")
    .in("code_hash", hashes);
  if (lookupError) throw lookupError;

  const redeemed = new Set(
    (existingRows || [])
      .filter((row) => (row.current_redemption_count || 0) >= 1)
      .map((row) => row.code_hash)
  );

  const payload = rows.map((row) => ({
    ...row,
    active: redeemed.has(row.code_hash) ? false : row.active
  }));

  const { error } = await supabase.from("promo_codes").upsert(payload, { onConflict: "code_hash" });
  if (error) throw error;

  const activeCount = payload.filter((row) => row.active).length;
  const usedCount = payload.length - activeCount;
  console.log(
    usedCount > 0
      ? `Seeded ${payload.length} ${label} (${activeCount} active, ${usedCount} already redeemed).`
      : `Seeded ${payload.length} ${label}.`
  );
}

async function seedProSupabase(supabase) {
  const proRow = buildProRow();
  const { data: existing, error: lookupError } = await supabase
    .from("promo_codes")
    .select("current_redemption_count")
    .eq("code_hash", proRow.code_hash)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const alreadyRedeemed = (existing?.current_redemption_count || 0) >= 1;
  const payload = {
    ...proRow,
    active: alreadyRedeemed ? false : true
  };

  const { error } = await supabase.from("promo_codes").upsert(payload, { onConflict: "code_hash" });
  if (error) throw error;
  console.log(
    alreadyRedeemed
      ? `Pro promo code ${proRow.public_code} already redeemed — left inactive.`
      : `Seeded single-use Pro promo code ${proRow.public_code}.`
  );
}

async function seedSupabase(plusRows, proMonthRows) {
  const config = supabaseConfig();
  if (!isUsableSupabaseConfig(config)) return { seeded: false, reason: "missing_env" };

  try {
    const supabase = createClient(config.url, config.key, { auth: { persistSession: false } });
    await retireOldCodesSupabase(supabase);
    const { error } = await supabase.from("promo_codes").upsert(plusRows, { onConflict: "code_hash" });
    if (error) {
      if (/relation .*promo_codes.* does not exist/i.test(error.message || "")) {
        const migrationError = new Error(
          "Supabase table promo_codes does not exist yet. Run supabase/migrations/20260710000000_promo_codes.sql in the Supabase SQL editor, then retry."
        );
        migrationError.cause = error;
        throw migrationError;
      }
      throw error;
    }

    console.log(`Seeded ${plusRows.length} single-use Plus promo codes into Supabase.`);
    await seedProSupabase(supabase);
    await upsertPromoRowsSupabase(supabase, proMonthRows, "1-month Pro promo codes into Supabase");
    return { seeded: true };
  } catch (error) {
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(String(error?.message || error))) {
      console.warn("Supabase unreachable; falling back to local Prisma/Postgres.");
      return { seeded: false, reason: "unreachable" };
    }
    throw error;
  }
}

async function retireOldCodesPrisma(prisma) {
  await prisma.promoCode.updateMany({
    where: { publicCode: { in: RETIRED_CODES } },
    data: { active: false, revokedAt: new Date() }
  });
  console.log(`Retired ${RETIRED_CODES.length} legacy Basic promo codes.`);
}

async function upsertPromoRowPrisma(prisma, row) {
  const existing = await prisma.promoCode.findUnique({
    where: { codeHash: row.code_hash },
    select: { currentRedemptionCount: true }
  });
  const alreadyRedeemed = (existing?.currentRedemptionCount || 0) >= 1;

  await prisma.promoCode.upsert({
    where: { codeHash: row.code_hash },
    update: {
      publicCode: row.public_code,
      description: row.description,
      campaignName: row.campaign_name,
      applicablePlan: row.applicable_plan,
      discountType: row.discount_type,
      singleUse: row.single_use,
      maxRedemptions: row.max_redemptions,
      maxRedemptionsPerUser: row.max_redemptions_per_user ?? 1,
      active: !alreadyRedeemed,
      newUsersOnly: row.new_users_only,
      accessDurationDays: row.access_duration_days,
      renewalBehavior: row.renewal_behavior,
      internalNotes: row.internal_notes ?? null,
      revokedAt: alreadyRedeemed ? undefined : null
    },
    create: {
      publicCode: row.public_code,
      codeHash: row.code_hash,
      description: row.description,
      campaignName: row.campaign_name,
      applicablePlan: row.applicable_plan,
      discountType: row.discount_type,
      singleUse: row.single_use,
      maxRedemptions: row.max_redemptions,
      maxRedemptionsPerUser: row.max_redemptions_per_user ?? 1,
      active: true,
      newUsersOnly: row.new_users_only,
      accessDurationDays: row.access_duration_days,
      renewalBehavior: row.renewal_behavior,
      internalNotes: row.internal_notes ?? null
    }
  });

  return alreadyRedeemed;
}

async function seedProPrisma(prisma) {
  const proRow = buildProRow();
  const alreadyRedeemed = await upsertPromoRowPrisma(prisma, proRow);
  console.log(
    alreadyRedeemed
      ? `Pro promo code ${proRow.public_code} already redeemed — left inactive.`
      : `Seeded single-use Pro promo code ${proRow.public_code}.`
  );
}

async function seedProMonthPrisma(prisma, proMonthRows) {
  let usedCount = 0;
  for (const row of proMonthRows) {
    const alreadyRedeemed = await upsertPromoRowPrisma(prisma, row);
    if (alreadyRedeemed) usedCount += 1;
  }
  console.log(
    usedCount > 0
      ? `Seeded ${proMonthRows.length} 1-month Pro promo codes into local Prisma/Postgres (${proMonthRows.length - usedCount} active, ${usedCount} already redeemed).`
      : `Seeded ${proMonthRows.length} 1-month Pro promo codes into local Prisma/Postgres.`
  );
}

async function seedPrisma(plusRows, proMonthRows) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

  if (!prisma.promoCode?.upsert) {
    throw new Error(
      "Prisma client is missing PromoCode models. Run: npx prisma generate\nThen apply migrations: npm run db:migrate:deploy (or npm run db:setup)"
    );
  }

  try {
    await retireOldCodesPrisma(prisma);
    for (const row of plusRows) {
      await prisma.promoCode.upsert({
        where: { codeHash: row.code_hash },
        update: {
          publicCode: row.public_code,
          description: row.description,
          campaignName: row.campaign_name,
          applicablePlan: row.applicable_plan,
          singleUse: row.single_use,
          maxRedemptions: row.max_redemptions,
          active: true,
          revokedAt: null
        },
        create: {
          publicCode: row.public_code,
          codeHash: row.code_hash,
          description: row.description,
          campaignName: row.campaign_name,
          applicablePlan: row.applicable_plan,
          discountType: row.discount_type,
          singleUse: row.single_use,
          maxRedemptions: row.max_redemptions,
          active: true,
          newUsersOnly: row.new_users_only,
          accessDurationDays: row.access_duration_days,
          renewalBehavior: row.renewal_behavior
        }
      });
    }
    console.log(`Seeded ${plusRows.length} single-use Plus promo codes into local Prisma/Postgres.`);
    await seedProPrisma(prisma);
    await seedProMonthPrisma(prisma, proMonthRows);
    return { seeded: true };
  } finally {
    await prisma.$disconnect();
  }
}

function printSetupHelp() {
  const { url, key } = supabaseConfig();
  console.error("\nCould not seed promo codes. Use one of these paths:\n");
  if (!url || !key) {
    console.error("Supabase (recommended for production):");
    console.error("  1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    console.error("  2. Run supabase/migrations/20260710000000_promo_codes.sql in the Supabase SQL editor");
    console.error("  3. npm run seed:promo-codes\n");
  }
  console.error("Local Prisma/Postgres:");
  console.error("  1. npm run db:setup");
  console.error("  2. npx prisma generate && npm run db:migrate:deploy");
  console.error("  3. npm run seed:promo-codes\n");
}

async function main() {
  const plusRows = buildPlusRows();
  const proMonthRows = buildProMonthRows();
  const supabaseResult = await seedSupabase(plusRows, proMonthRows);
  if (supabaseResult.seeded) {
    console.log("\n1-month Pro promo codes:");
    for (const code of PRO_MONTH_CODES) console.log(`  ${code}`);
    return;
  }

  try {
    await seedPrisma(plusRows, proMonthRows);
    console.log("\n1-month Pro promo codes:");
    for (const code of PRO_MONTH_CODES) console.log(`  ${code}`);
  } catch (error) {
    if (/Can't reach database server|P1001/i.test(error.message || "")) {
      printSetupHelp();
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
