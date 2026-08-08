import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FIX_SQL = readFileSync(
  new URL("../supabase/migrations/20260807200000_fix_ambiguous_mentor_id_reward_rpcs.sql", import.meta.url),
  "utf8"
);

const BROKEN_SQL = readFileSync(
  new URL("../supabase/migrations/20260807180000_progress_rewards_complete_claim_redeem.sql", import.meta.url),
  "utf8"
);

describe("complete_mentor_reward_task mentor_id ambiguity fix", () => {
  it("prior migration shadowed mentor_matches.mentor_id with a PL/pgSQL variable", () => {
    expect(BROKEN_SQL).toMatch(/declare\s+mentor_id uuid := \(select auth\.uid\(\)\)/);
    expect(BROKEN_SQL).toMatch(/mm\.mentor_id = mentor_id/);
  });

  it("fix migration renames the actor variable and qualifies match columns", () => {
    expect(FIX_SQL).toMatch(/create or replace function public\.complete_mentor_reward_task/);
    expect(FIX_SQL).toMatch(/v_mentor_id uuid := \(select auth\.uid\(\)\)/);
    expect(FIX_SQL).toMatch(/mm\.mentor_id = v_mentor_id/);
    expect(FIX_SQL).not.toMatch(/declare\s+mentor_id uuid/);
    expect(FIX_SQL).not.toMatch(/mm\.mentor_id = mentor_id/);
  });

  it("keeps assignment authorization on assigned/accepted/active matches only", () => {
    expect(FIX_SQL).toMatch(/mm\.status in \('assigned', 'accepted', 'active'\)/);
    expect(FIX_SQL).toMatch(/You are not assigned to this student/);
  });

  it("does not touch Stripe, essay support, or session-credit tables", () => {
    const sqlBody = FIX_SQL
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(sqlBody).not.toMatch(/stripe/i);
    expect(sqlBody).not.toMatch(/essay_support|session_credit|subscriptions/i);
  });
});
