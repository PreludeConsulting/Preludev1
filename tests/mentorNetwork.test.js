import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeNextOpening } from "../src/lib/mentorNextOpening.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const MIGRATION = "supabase/migrations/20260808000000_student_mentor_network.sql";

describe("student_mentor_network migration", () => {
  const sql = read(MIGRATION);

  it("stores ONLY membership, never duplicated mentor detail", () => {
    expect(sql).toMatch(/create table if not exists public\.student_mentor_network/i);
    expect(sql).toMatch(/student_id\s+uuid not null references auth\.users/i);
    expect(sql).toMatch(/mentor_id\s+uuid not null references auth\.users/i);
    expect(sql).toMatch(/created_by\s+uuid/i);
    // No copied profile fields on the membership table.
    const tableBlock = sql.slice(
      sql.indexOf("create table if not exists public.student_mentor_network"),
      sql.indexOf("create index if not exists student_mentor_network_student_idx")
    );
    expect(tableBlock).not.toMatch(/display_name|avatar_url|college|major|bio|target_|availability|specialties/i);
  });

  it("enforces a single membership per student+mentor pair", () => {
    expect(sql).toMatch(/constraint student_mentor_network_unique unique \(student_id, mentor_id\)/i);
    expect(sql).toMatch(/on conflict \(student_id, mentor_id\) do nothing/i);
  });

  it("enables RLS and blocks direct client writes", () => {
    expect(sql).toMatch(/alter table public\.student_mentor_network enable row level security/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.student_mentor_network from anon, authenticated/i);
    expect(sql).toMatch(/auth\.uid\(\) = student_id\s*\n\s*or public\.is_prelude_admin\(\)/i);
  });

  it("gates eligibility on active Plus/Pro from profiles, independent of Essay Support", () => {
    expect(sql).toMatch(/function public\.student_has_mentor_network_access/i);
    expect(sql).toMatch(/plan not in \('plus', 'pro'\)/i);
    expect(sql).toMatch(/from public\.profiles/i);
    // Essay Support ledger must never be queried by the entitlement gate.
    const gate = sql.slice(
      sql.indexOf("function public.student_has_mentor_network_access"),
      sql.indexOf("function public.admin_get_student_network")
    );
    expect(gate).not.toMatch(/from\s+public\.review_credit_ledger/i);
    expect(gate).not.toMatch(/review_credit_ledger/i);
  });

  it("guards admin RPCs behind is_prelude_admin and student eligibility", () => {
    expect(sql).toMatch(/function public\.admin_add_student_network_mentor/i);
    expect(sql).toMatch(/function public\.admin_remove_student_network_mentor/i);
    expect(sql).toMatch(/if not public\.is_prelude_admin\(\) then/i);
    // Adding requires the student to be Plus/Pro eligible.
    const addBlock = sql.slice(sql.indexOf("admin_add_student_network_mentor"));
    expect(addBlock).toMatch(/if not public\.student_has_mentor_network_access\(p_student\) then/i);
  });

  it("returns the student's OWN network with live profile data only", () => {
    expect(sql).toMatch(/function public\.list_my_network_mentors/i);
    expect(sql).toMatch(/uid uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/join public\.mentor_matching_profiles/i);
    expect(sql).toMatch(/where smn\.student_id = uid/i);
  });

  it("hands off to existing messaging via an isolated mentor_network chat_type", () => {
    expect(sql).toMatch(/chat_type in \('mentor_student', 'mentor_parent', 'mentor_network'\)/i);
    expect(sql).toMatch(/function public\.ensure_network_chat_thread/i);
    // Must verify Plus/Pro + network membership before opening a thread.
    const ensureBlock = sql.slice(sql.indexOf("function public.ensure_network_chat_thread"));
    expect(ensureBlock).toMatch(/student_has_mentor_network_access\(uid\)/i);
    expect(ensureBlock).toMatch(/from public\.student_mentor_network as smn/i);
    // Reuses an existing assignment conversation instead of duplicating it.
    expect(ensureBlock).toMatch(/chat_type = 'mentor_student'/i);
  });
});

describe("Mentor Network frontend contracts", () => {
  it("student panel loads only MY network, not all mentors", () => {
    const panel = read("src/dashboard/components/chat/MessagesMentorNetworkPanel.jsx");
    expect(panel).toMatch(/listMyMentorNetwork/);
    expect(panel).not.toMatch(/listMentorNetworkProfiles/);
    expect(panel).toMatch(/onMessageMentor/);
  });

  it("network API calls the backend-enforced RPCs", () => {
    const api = read("src/lib/mentorNetworkApi.js");
    expect(api).toMatch(/rpc\("list_my_network_mentors"\)/);
    expect(api).toMatch(/rpc\("ensure_network_chat_thread"/);
    expect(api).toMatch(/rpc\("admin_get_student_network"/);
    expect(api).toMatch(/rpc\("admin_add_student_network_mentor"/);
    expect(api).toMatch(/rpc\("admin_remove_student_network_mentor"/);
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
