import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeNextOpening } from "../src/lib/mentorNextOpening.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const MIGRATION = "supabase/migrations/20260808010000_global_mentor_network.sql";

describe("global mentor_network migration", () => {
  const sql = read(MIGRATION);

  it("removes the incorrect per-student membership model", () => {
    expect(sql).toMatch(/drop table if exists public\.student_mentor_network cascade/i);
    expect(sql).toMatch(/drop function if exists public\.list_my_network_mentors\(\)/i);
    expect(sql).toMatch(/drop function if exists public\.admin_get_student_network\(uuid\)/i);
    expect(sql).toMatch(/drop function if exists public\.admin_add_student_network_mentor\(uuid, uuid\)/i);
    expect(sql).toMatch(/drop function if exists public\.admin_remove_student_network_mentor\(uuid, uuid\)/i);
  });

  it("stores ONE global membership row per mentor, no per-student column", () => {
    expect(sql).toMatch(/create table if not exists public\.mentor_network_members/i);
    expect(sql).toMatch(/mentor_id\s+uuid primary key references auth\.users/i);
    expect(sql).toMatch(/created_by\s+uuid/i);
    const tableBlock = sql.slice(
      sql.indexOf("create table if not exists public.mentor_network_members"),
      sql.indexOf("alter table public.mentor_network_members enable row level security")
    );
    // Not scoped to any student, and no duplicated profile fields.
    expect(tableBlock).not.toMatch(/student_id/i);
    expect(tableBlock).not.toMatch(/display_name|avatar_url|college|major|bio|target_|availability|specialties/i);
  });

  it("enables RLS and blocks direct client writes", () => {
    expect(sql).toMatch(/alter table public\.mentor_network_members enable row level security/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.mentor_network_members from anon, authenticated/i);
  });

  it("gates eligibility on active Plus/Pro from profiles, independent of Essay Support", () => {
    expect(sql).toMatch(/plan not in \('plus', 'pro'\)|student_has_mentor_network_access/i);
    // The global list RPC gates on the Plus/Pro entitlement helper.
    const listBlock = sql.slice(
      sql.indexOf("function public.list_global_network_mentors"),
      sql.indexOf("function public.ensure_network_chat_thread")
    );
    expect(listBlock).toMatch(/student_has_mentor_network_access\(uid\)/i);
    expect(listBlock).not.toMatch(/review_credit_ledger/i);
    // Membership is NOT scoped by student id anywhere in the list query.
    expect(listBlock).not.toMatch(/student_id/i);
  });

  it("guards admin RPCs behind is_prelude_admin, with no student argument", () => {
    expect(sql).toMatch(/function public\.admin_list_network_members\(\)/i);
    expect(sql).toMatch(/function public\.admin_add_network_member\(p_mentor uuid\)/i);
    expect(sql).toMatch(/function public\.admin_remove_network_member\(p_mentor uuid\)/i);
    expect(sql).toMatch(/if not public\.is_prelude_admin\(\) then/i);
    const addBlock = sql.slice(
      sql.indexOf("function public.admin_add_network_member"),
      sql.indexOf("function public.admin_remove_network_member")
    );
    // Global add takes no student and does not consult per-student eligibility.
    expect(addBlock).not.toMatch(/p_student/i);
    expect(addBlock).toMatch(/on conflict \(mentor_id\) do nothing/i);
  });

  it("returns the SAME global network with live profile data for every student", () => {
    expect(sql).toMatch(/function public\.list_global_network_mentors/i);
    expect(sql).toMatch(/uid uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/join public\.mentor_matching_profiles/i);
    expect(sql).toMatch(/from public\.mentor_network_members as mnm/i);
  });

  it("hands off to existing messaging via global membership, no per-student check", () => {
    expect(sql).toMatch(/function public\.ensure_network_chat_thread/i);
    const ensureBlock = sql.slice(sql.indexOf("function public.ensure_network_chat_thread"));
    expect(ensureBlock).toMatch(/student_has_mentor_network_access\(uid\)/i);
    expect(ensureBlock).toMatch(/from public\.mentor_network_members as mnm/i);
    expect(ensureBlock).not.toMatch(/student_mentor_network/i);
    // Reuses an existing assignment conversation instead of duplicating it.
    expect(ensureBlock).toMatch(/chat_type = 'mentor_student'/i);
  });
});

describe("Mentor Network frontend contracts", () => {
  it("student panel loads the global network, not per-student or all mentors", () => {
    const panel = read("src/dashboard/components/chat/MessagesMentorNetworkPanel.jsx");
    expect(panel).toMatch(/listGlobalMentorNetwork/);
    expect(panel).not.toMatch(/listMyMentorNetwork/);
    expect(panel).not.toMatch(/listMentorNetworkProfiles/);
    expect(panel).toMatch(/onMessageMentor/);
  });

  it("admin page manages the global network with no student selector", () => {
    const page = read("src/dashboard/pages/admin/AdminNetworkPage.jsx");
    expect(page).toMatch(/adminListNetworkMembers/);
    expect(page).toMatch(/adminAddNetworkMember/);
    expect(page).toMatch(/adminRemoveNetworkMember/);
    // No per-student selection concepts remain.
    expect(page).not.toMatch(/selectedStudent|adminGetStudentNetwork|Mentor Network for/i);
  });

  it("network API calls the backend-enforced global RPCs", () => {
    const api = read("src/lib/mentorNetworkApi.js");
    expect(api).toMatch(/rpc\("list_global_network_mentors"\)/);
    expect(api).toMatch(/rpc\("ensure_network_chat_thread"/);
    expect(api).toMatch(/rpc\("admin_list_network_members"\)/);
    expect(api).toMatch(/rpc\("admin_add_network_member"/);
    expect(api).toMatch(/rpc\("admin_remove_network_member"/);
    // Per-student RPCs are gone.
    expect(api).not.toMatch(/admin_get_student_network|admin_add_student_network_mentor|list_my_network_mentors/);
  });

  it("admin Network tab + route are registered next to Matching", () => {
    const router = read("src/dashboard/DashboardRouter.jsx");
    expect(router).toMatch(/\{ to: "\/matching", label: "Matching", icon: UserCheck \}, \{ to: "\/network", label: "Network", icon: Network \}/);
    expect(router).toMatch(/path="network" element=\{<MatchingTeamGuard><AdminNetworkPage \/><\/MatchingTeamGuard>\}/);
  });

  it("appends Network beside Matching only for matching-team/admin nav", () => {
    const layout = read("src/dashboard/components/DashboardLayout.jsx");
    // Gated by the same matching-team access flag as Matching.
    expect(layout).toMatch(/if \(!showMatchingNav\) return items;/);
    // Network is pushed after Matching, and only when not already present.
    const matchingIdx = layout.indexOf('label: "Matching"');
    const networkIdx = layout.indexOf('label: "Network"');
    expect(matchingIdx).toBeGreaterThan(-1);
    expect(networkIdx).toBeGreaterThan(matchingIdx);
    expect(layout).toMatch(/import \{ Network, UserCheck \} from "lucide-react"/);
  });

  it("mounts the network route wherever matching is mounted", () => {
    const router = read("src/dashboard/DashboardRouter.jsx");
    const networkRoutes = router.match(/path="network" element=\{<MatchingTeamGuard><AdminNetworkPage \/><\/MatchingTeamGuard>\}/g) || [];
    // student, mentor, parent, admin
    expect(networkRoutes.length).toBe(4);
  });
});

describe("Next Opening calculation (live availability)", () => {
  const scheduleET = {
    timezone: "ET",
    days: [
      { dayOfWeek: "Monday", enabled: true, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: "Tuesday", enabled: true, startTime: "16:00", endTime: "18:00" },
      { dayOfWeek: "Thursday", enabled: true, startTime: "13:00", endTime: "17:00" }
    ]
  };

  it("skips today's elapsed window and returns the next upcoming slot", () => {
    // Monday 2:00 PM ET (EDT = UTC-4) -> 18:00 UTC
    const now = new Date("2026-08-10T18:00:00Z");
    expect(computeNextOpening(scheduleET, now)).toBe("Tuesday, 4:00 PM ET");
  });

  it("rolls over to next week when the rest of the week is exhausted", () => {
    // Friday 6:00 PM ET -> next opening is Monday 9:00 AM
    const now = new Date("2026-08-14T22:00:00Z");
    expect(computeNextOpening(scheduleET, now)).toBe("Monday, 9:00 AM ET");
  });

  it("returns null when the mentor has no enabled availability", () => {
    expect(computeNextOpening({ timezone: "ET", days: [] })).toBeNull();
    expect(computeNextOpening(null)).toBeNull();
  });
});
