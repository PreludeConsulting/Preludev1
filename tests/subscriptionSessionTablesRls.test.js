import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = "supabase/migrations/20260801000000_subscription_session_tables_service_role_rls.sql";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("subscription session tables service-role RLS", () => {
  const sql = read(migration);

  it("enables RLS on both subscription session tables", () => {
    expect(sql).toMatch(/alter table public\.subscription_session_periods enable row level security/i);
    expect(sql).toMatch(/alter table public\.subscription_session_reservations enable row level security/i);
  });

  it("revokes client roles and grants only service_role (no permissive policies)", () => {
    expect(sql).toMatch(
      /revoke all on table public\.subscription_session_periods from public, anon, authenticated/i
    );
    expect(sql).toMatch(
      /revoke all on table public\.subscription_session_reservations from public, anon, authenticated/i
    );
    expect(sql).toMatch(/grant all on table public\.subscription_session_periods to service_role/i);
    expect(sql).toMatch(/grant all on table public\.subscription_session_reservations to service_role/i);
    expect(sql).not.toMatch(/create policy[\s\S]*on public\.subscription_session_periods/i);
    expect(sql).not.toMatch(/create policy[\s\S]*on public\.subscription_session_reservations/i);
    expect(sql).toMatch(/drop policy if exists/i);
  });

  it("does not weaken meetings or other tables", () => {
    expect(sql).not.toMatch(/alter table public\.meetings/i);
    expect(sql).not.toMatch(/disable row level security/i);
    expect(sql).not.toMatch(/grant .* to anon/i);
    expect(sql).not.toMatch(/grant .* to authenticated/i);
  });
});
