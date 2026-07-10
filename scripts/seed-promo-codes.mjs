#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./db-utils.mjs";

const SAMPLE_CODES = [
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

function hashCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

function buildRows() {
  return SAMPLE_CODES.map((publicCode, index) => ({
    public_code: publicCode,
    code_hash: hashCode(publicCode),
    description: `Sample complimentary Basic Plan code ${index + 1}`,
    campaign_name: "Launch Complimentary Basic",
    applicable_plan: "basic",
    discount_type: "complimentary",
    single_use: false,
    max_redemptions: null,
    active: true,
    new_users_only: true,
    access_duration_days: null,
    renewal_behavior: "requires_payment"
  }));
}

async function seedSupabase(rows) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("promo_codes").upsert(rows, { onConflict: "code_hash" });
  if (error) throw error;
  console.log(`Seeded ${rows.length} promo codes into Supabase.`);
  return true;
}

async function seedPrisma(rows) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
  try {
    for (const row of rows) {
      await prisma.promoCode.upsert({
        where: { codeHash: row.code_hash },
        update: {
          publicCode: row.public_code,
          description: row.description,
          campaignName: row.campaign_name,
          active: true
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
    console.log(`Seeded ${rows.length} promo codes into Prisma.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const rows = buildRows();
  const supabaseSeeded = await seedSupabase(rows);
  if (!supabaseSeeded) {
    await seedPrisma(rows);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
