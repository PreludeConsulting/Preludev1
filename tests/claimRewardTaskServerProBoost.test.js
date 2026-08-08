import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

describe("claim_reward_task server Pro Boost migration", () => {
  const sql = read("supabase/migrations/20260807210000_claim_reward_task_server_pro_boost.sql");

  it("defines claim_reward_task(p_task_instance_id uuid) only", () => {
    expect(sql).toMatch(/drop function if exists public\.claim_reward_task\(uuid, boolean\)/i);
    expect(sql).toMatch(/create or replace function public\.claim_reward_task\(\s*p_task_instance_id uuid\s*\)/i);
    expect(sql).not.toMatch(/p_pro_boost\s+boolean/i);
  });

  it("derives Pro Boost from profiles.plan_id server-side", () => {
    expect(sql).toMatch(/from public\.profiles p/i);
    expect(sql).toMatch(/student_plan = 'pro'/);
    expect(sql).toMatch(/v_pro_boost/);
  });

  it("claims atomically and awards coins once", () => {
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/status = 'claimed'/);
    expect(sql).toMatch(/status in \('ready_to_claim', 'completed_by_mentor'\)/);
    expect(sql).toMatch(/insert into public\.coin_transactions/i);
    expect(sql).toMatch(/notify pgrst,\s*'reload schema'/i);
  });
});

describe("claimRewardTask frontend contract", () => {
  it("omits p_pro_boost so it matches claim_reward_task(uuid)", () => {
    const src = read("src/lib/dashboardData.js");
    const rpcBlock = src.match(/rpc\(\s*["']claim_reward_task["'][\s\S]*?\}\)/);
    expect(rpcBlock).toBeTruthy();
    expect(rpcBlock[0]).toMatch(/p_task_instance_id/);
    expect(rpcBlock[0]).not.toMatch(/p_pro_boost/);
  });
});
