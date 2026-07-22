import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = "supabase/migrations/20260721000000_production_security_hardening.sql";
const read = (file) => {
  const absolutePath = path.join(root, file);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
};

function grantedColumns(sql, privilege, table) {
  const match = sql.match(
    new RegExp(`grant ${privilege}\\s*\\(([^)]*)\\)\\s*on table public\\.${table} to authenticated`, "i")
  );
  return (match?.[1] || "")
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

function declaredColumns(table) {
  const migrationDirectory = path.join(root, "supabase/migrations");
  const sources = [read("supabase/setup-dashboard-data.sql")];
  for (const file of fs.readdirSync(migrationDirectory).sort()) {
    if (file >= path.basename(migrationPath) || !file.endsWith(".sql")) continue;
    sources.push(read(`supabase/migrations/${file}`));
  }
  const combined = sources.join("\n");
  const columns = new Set();
  const createMatch = combined.match(
    new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i")
  );
  for (const line of (createMatch?.[1] || "").split("\n")) {
    const column = line.match(/^\s*([a-z_][a-z0-9_]*)\s+/i)?.[1];
    if (column && !["constraint", "primary", "unique", "check", "foreign"].includes(column.toLowerCase())) {
      columns.add(column.toLowerCase());
    }
  }
  const addColumn = new RegExp(
    `alter table(?: if exists)? public\\.${table}(?:(?!;)[\\s\\S])*?add column if not exists\\s+([a-z_][a-z0-9_]*)`,
    "gi"
  );
  for (const match of combined.matchAll(addColumn)) columns.add(match[1].toLowerCase());
  return columns;
}

describe("Supabase production security hardening", () => {
  const sql = read(migrationPath);

  it("makes plan, subscription, promotion, and payment completion fields server-owned", () => {
    const profileUpdateGrant = grantedColumns(sql, "update", "profiles");
    expect(sql).toMatch(/revoke update on table public\.profiles from authenticated/i);
    expect(sql).toMatch(/grant update \([\s\S]*full_name[\s\S]*\) on table public\.profiles to authenticated/i);
    expect(profileUpdateGrant).toEqual(expect.arrayContaining(["id", "role", "role_selection_complete"]));
    expect(profileUpdateGrant.join(",")).not.toMatch(/plan_id|stripe_|subscription_|payment_waived|promo_/i);
    expect(sql).toMatch(/function public\.enforce_profile_entitlement_guard\(\)/i);
    expect(sql).toMatch(/new\.plan_id is distinct from old\.plan_id/i);
    expect(sql).toMatch(/new\.payment_waived is distinct from old\.payment_waived/i);
    expect(sql).toMatch(/new\.subscription_status is distinct from old\.subscription_status/i);
    expect(sql).toMatch(/function public\.enforce_onboarding_payment_guard\(\)/i);
    expect(sql).toMatch(/new\.payment_step_completed is distinct from old\.payment_step_completed/i);
    expect(sql).toMatch(/alter function public\.redeem_promo_code\(text, text, uuid\)[\s\S]*prelude\.allow_entitlement_write/i);
    expect(sql).toMatch(/revoke all on function public\.redeem_promo_code\(text, text, uuid\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.redeem_promo_code\(text, text, uuid\) to service_role/i);
  });

  it("makes message attachments private and participant scoped for every operation", () => {
    expect(sql).toMatch(/'message-attachments'[\s\S]*public\s*=\s*false/i);
    expect(sql).toMatch(/function public\.is_message_attachment_participant\(object_name text\)/i);
    expect(sql).toMatch(/storage\.foldername\(object_name\)\)\[2\]/i);
    expect(sql).toMatch(/Message attachments readable by participants[\s\S]*is_message_attachment_participant\(name\)/i);
    expect(sql).toMatch(/Message attachments upload by participants[\s\S]*auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\][\s\S]*is_message_attachment_participant\(name\)/i);
    expect(sql).toMatch(/Message attachments update by owner participant/i);
    expect(sql).toMatch(/Message attachments delete by owner participant/i);

    const standaloneChat = read("supabase/chat-messaging.sql");
    expect(standaloneChat).toMatch(/'message-attachments'[\s\S]*false/i);
    expect(standaloneChat).not.toMatch(/'message-attachments',\s*'message-attachments',\s*true/i);
    expect(standaloneChat).toMatch(/Message attachments readable by participants[\s\S]*is_message_attachment_participant\(name\)/i);
    expect(standaloneChat).toMatch(/Chat threads insertable for authorized relationships[\s\S]*is_authorized_chat_relationship\(chat_type, mentor_id, student_id, parent_id\)/i);
  });

  it("enables RLS on session packages and exposes no authenticated mutation path", () => {
    expect(sql).toMatch(/alter table public\.session_package_purchases enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.session_package_purchases from anon, authenticated/i);
    expect(sql).toMatch(/grant select on table public\.session_package_purchases to authenticated/i);
    expect(sql).toMatch(/Session packages viewable by owning student[\s\S]*auth\.uid\(\)\s*=\s*student_user_id/i);
    expect(sql).not.toMatch(/session_package_purchases for (insert|update|delete) to authenticated/i);
  });

  it("requires a mentor role and server approval for matching profiles", () => {
    const mentorUpdateGrant = grantedColumns(sql, "update", "mentor_matching_profiles");
    expect(sql).toMatch(/mentor_matching_profiles[\s\S]*add column if not exists approved boolean not null default false/i);
    expect(sql).toMatch(/function public\.is_mentor_role\(candidate_user_id uuid\)/i);
    expect(sql).toMatch(/function public\.enforce_mentor_matching_profile_guard\(\)/i);
    expect(sql).toMatch(/new\.approved is distinct from old\.approved/i);
    expect(sql).toMatch(/mentor_matching_profiles_approval_state_check[\s\S]*approved = false[\s\S]*approved_at is null[\s\S]*approved_by is null[\s\S]*approved = true[\s\S]*approved_at is not null[\s\S]*approved_by is not null/i);
    expect(sql).toMatch(/Mentor profiles visible after approval[\s\S]*approved = true[\s\S]*is_mentor_role\(mentor_user_id\)/i);
    expect(sql).toMatch(/Mentor matching profiles insertable by mentor owner[\s\S]*auth\.uid\(\) = mentor_user_id[\s\S]*is_mentor_role\(mentor_user_id\)/i);
    expect(sql).toMatch(/revoke update on table public\.mentor_matching_profiles from authenticated/i);
    expect(mentorUpdateGrant).toContain("mentor_user_id");
    expect(mentorUpdateGrant.join(",")).not.toMatch(/approved/i);
  });

  it("authorizes new chat threads through active mentor and household relationships", () => {
    expect(sql).toMatch(/function public\.is_authorized_chat_relationship\([\s\S]*requested_chat_type text[\s\S]*requested_mentor_id uuid[\s\S]*requested_student_id uuid[\s\S]*requested_parent_id uuid/i);
    expect(sql).toMatch(/from public\.mentor_matches[\s\S]*match\.status = 'assigned'/i);
    expect(sql).toMatch(/from public\.mentor_matching_profiles as approved_mentor[\s\S]*approved_mentor\.approved = true/i);
    expect(sql).toMatch(/from public\.parent_student_links/i);
    expect(sql).toMatch(/Chat threads insertable for authorized relationships[\s\S]*is_authorized_chat_relationship\(chat_type, mentor_id, student_id, parent_id\)/i);
  });

  it("deletes mentor matching profiles through their real primary key", () => {
    expect(sql).toMatch(/delete from public\.mentor_matching_profiles where mentor_user_id = uid/i);
    expect(sql).not.toMatch(/delete from public\.mentor_matching_profiles where user_id = uid/i);

    const standalone = read("supabase/delete-account.sql");
    expect(standalone).toMatch(/delete from public\.mentor_matching_profiles where mentor_user_id = uid/i);
    expect(standalone).not.toMatch(/delete from public\.mentor_matching_profiles where user_id = uid/i);
  });

  it("grants only columns declared by the ordered Prelude schema", () => {
    for (const table of ["profiles", "onboarding_progress", "mentor_matching_profiles"]) {
      const declared = declaredColumns(table);
      const granted = [
        ...grantedColumns(sql, "insert", table),
        ...grantedColumns(sql, "update", table)
      ];
      expect({ table, missing: granted.filter((column) => !declared.has(column)) }).toEqual({
        table,
        missing: []
      });
    }
  });

  it("preserves owner-key updates required by PostgREST upserts", () => {
    expect(grantedColumns(sql, "update", "profiles")).toContain("id");
    expect(grantedColumns(sql, "update", "onboarding_progress")).toContain("user_id");
    expect(grantedColumns(sql, "update", "mentor_matching_profiles")).toContain("mentor_user_id");
  });
});
