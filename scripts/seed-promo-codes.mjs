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

async function seedSupabase(plusRows) {
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

async function seedProPrisma(prisma) {
  const proRow = buildProRow();
  const existing = await prisma.promoCode.findUnique({
    where: { codeHash: proRow.code_hash },
    select: { currentRedemptionCount: true }
  });
  const alreadyRedeemed = (existing?.currentRedemptionCount || 0) >= 1;

  await prisma.promoCode.upsert({
    where: { codeHash: proRow.code_hash },
    update: {
      publicCode: proRow.public_code,
      description: proRow.description,
      campaignName: proRow.campaign_name,
      applicablePlan: proRow.applicable_plan,
      discountType: proRow.discount_type,
      singleUse: proRow.single_use,
      maxRedemptions: proRow.max_redemptions,
      maxRedemptionsPerUser: proRow.max_redemptions_per_user,
      active: !alreadyRedeemed,
      newUsersOnly: proRow.new_users_only,
      accessDurationDays: proRow.access_duration_days,
      renewalBehavior: proRow.renewal_behavior,
      internalNotes: proRow.internal_notes,
      revokedAt: alreadyRedeemed ? undefined : null
    },
    create: {
      publicCode: proRow.public_code,
      codeHash: proRow.code_hash,
      description: proRow.description,
      campaignName: proRow.campaign_name,
      applicablePlan: proRow.applicable_plan,
      discountType: proRow.discount_type,
      singleUse: proRow.single_use,
      maxRedemptions: proRow.max_redemptions,
      maxRedemptionsPerUser: proRow.max_redemptions_per_user,
      active: true,
      newUsersOnly: proRow.new_users_only,
      accessDurationDays: proRow.access_duration_days,
      renewalBehavior: proRow.renewal_behavior,
      internalNotes: proRow.internal_notes
    }
  });

  console.log(
    alreadyRedeemed
      ? `Pro promo code ${proRow.public_code} already redeemed — left inactive.`
      : `Seeded single-use Pro promo code ${proRow.public_code}.`
  );
}

async function seedPrisma(plusRows) {
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
  const supabaseResult = await seedSupabase(plusRows);
  if (supabaseResult.seeded) return;

  try {
    await seedPrisma(plusRows);
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
