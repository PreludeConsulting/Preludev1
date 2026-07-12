import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("Supabase rewards and availability schema reconciliation", () => {
  const migrationPath = "supabase/migrations/20260711001000_schema_reconciliation.sql";

  it("creates one owner-readable rewards ledger with indexed lookups", () => {
    const sql = read(migrationPath);
    expect(sql).toMatch(/create table if not exists public\.reward_redemptions/i);
    expect(sql).toMatch(/create unique index if not exists reward_redemptions_user_reward_idx[\s\S]*\(user_id, reward_id\)/i);
    expect(sql).toMatch(/reward_redemptions_user_redeemed_idx/i);
    expect(sql).toMatch(/reward_redemptions_reward_idx/i);
    expect(sql).toMatch(/for select to authenticated[\s\S]*auth\.uid\(\)\) = user_id/i);
    expect(sql).not.toMatch(/reward_redemptions[\s\S]*for all to authenticated/i);
  });

  it("redeems through an atomic RPC that owns cost and wallet mutation", () => {
    const sql = read(migrationPath);
    expect(sql).toMatch(/function public\.redeem_catalog_reward\s*\(/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/from \(values[\s\S]*where reward\.id = p_reward_id/i);
    expect(sql).toMatch(/update public\.reward_wallets/i);
    expect(sql).toMatch(/insert into public\.reward_redemptions/i);
    expect(sql).toMatch(/grant execute on function public\.redeem_catalog_reward/i);
    expect(sql).toMatch(/notify pgrst, 'reload schema'/i);
  });

  it("uses mentor_matching_profiles availability_schedule as the only availability model", () => {
    const reconciliation = read(migrationPath);
    const helpers = read("src/lib/dashboardData.js");
    const loader = read("src/lib/supabaseData.js");
    const prisma = read("prisma/schema.prisma");
    expect(reconciliation).toMatch(/mentor_matching_profiles[\s\S]*availability_schedule/i);
    expect(reconciliation).toMatch(/drop column if exists hourly_availability/i);
    expect(helpers).not.toContain("hourly_availability");
    expect(loader).not.toContain("getMentorHourlyAvailability");
    expect(prisma).not.toContain("hourlyAvailability");
  });

  it("does not expose raw schema-cache errors in dashboard feature messages", () => {
    const helpers = read("src/lib/dashboardData.js");
    const persistence = read("src/lib/supabaseData.js");
    expect(helpers).toContain("Rewards are temporarily unavailable. Retry in a moment.");
    expect(persistence).toContain("Some dashboard data is temporarily unavailable. Refresh to retry.");
    expect(persistence).not.toContain('if (messages.length) return messages.join(" ")');
  });
});
