import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationDir = path.join(root, "supabase/migrations");
const reconciliation = "supabase/migrations/20260731000000_dashboard_production_reconciliation.sql";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function migrationVersions() {
  return fs
    .readdirSync(migrationDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.slice(0, 14));
}

describe("dashboard production reconciliation migration", () => {
  const sql = read(reconciliation);

  it("uses unique chronological migration versions (no colliding prefixes)", () => {
    const versions = migrationVersions();
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("creates the canonical meetings table with Prisma contract fields", () => {
    expect(sql).toMatch(/create table if not exists public\.meetings/i);
    for (const column of [
      "student_user_id",
      "mentor_user_id",
      "start_time",
      "end_time",
      "status",
      "idempotency_key",
      "session_package_id",
      "subscription_session_period_id",
      "updated_at"
    ]) {
      expect(sql).toMatch(new RegExp(column, "i"));
    }
    expect(sql).toMatch(/meetings_status_check/i);
    expect(sql).toMatch(/meetings_time_range_check/i);
    expect(sql).toMatch(/meetings_idempotency_key_key/i);
    expect(sql).toMatch(/idx_meetings_student_user_status/i);
    expect(sql).toMatch(/idx_meetings_mentor_user_status/i);
    expect(sql).toMatch(/touch_meetings_updated_at/i);
  });

  it("adds drifted calendar and mentor_match timestamps without duplicate tables", () => {
    expect(sql).toMatch(/alter table public\.calendar_events[\s\S]*add column if not exists updated_at/i);
    expect(sql).toMatch(/alter table public\.mentor_matches[\s\S]*add column if not exists updated_at/i);
    expect(sql).not.toMatch(/create table if not exists public\.meeting_requests/i);
    expect(sql).not.toMatch(/create table if not exists public\.conversation_members/i);
    expect(sql).not.toMatch(/create table if not exists public\.mentor_availability/i);
  });

  it("ships operation-specific meetings RLS and participant guards", () => {
    expect(sql).toMatch(/meetings_participant_select/i);
    expect(sql).toMatch(/meetings_student_insert_request/i);
    expect(sql).toMatch(/meetings_mentor_insert_scheduled/i);
    expect(sql).toMatch(/meetings_student_update_own/i);
    expect(sql).toMatch(/meetings_mentor_update_assigned/i);
    expect(sql).toMatch(/enforce_meeting_participant_guard/i);
    expect(sql).toMatch(/has_active_mentor_match/i);
    expect(sql).toMatch(/revoke delete on table public\.meetings from authenticated/i);
  });

  it("hardens grants, avatar listing, message tamper guard, and RPC execute", () => {
    expect(sql).toMatch(/drop policy if exists "Avatar images are publicly readable"/i);
    expect(sql).toMatch(/Avatar images readable by owner/i);
    expect(sql).toMatch(/enforce_message_update_guard/i);
    expect(sql).toMatch(/Messages viewable by thread members/i);
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(/revoke all on function public\.%s from public, anon, authenticated/i);
    expect(sql).toMatch(/notify pgrst, 'reload schema'/i);
  });
});
