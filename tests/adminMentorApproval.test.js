import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => ({ rpc })
}));

import {
  listMentorProfileApprovals,
  setMentorProfileApproval
} from "../src/lib/adminMentorApprovalService.js";

describe("admin mentor approval service", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("loads the private mentor review queue through the admin RPC", async () => {
    const profiles = [{ mentorUserId: "mentor-1", completed: true, approved: false }];
    rpc.mockResolvedValueOnce({ data: profiles, error: null });

    await expect(listMentorProfileApprovals()).resolves.toEqual(profiles);
    expect(rpc).toHaveBeenCalledWith("admin_list_mentor_profile_approvals");
  });

  it("sends the selected approval state through the admin RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: { mentorUserId: "mentor-1", approved: true },
      error: null
    });

    await expect(setMentorProfileApproval("mentor-1", true)).resolves.toMatchObject({
      mentorUserId: "mentor-1",
      approved: true
    });
    expect(rpc).toHaveBeenCalledWith("admin_set_mentor_profile_approval", {
      p_mentor_user_id: "mentor-1",
      p_approved: true
    });
  });

  it("surfaces database authorization errors", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Prelude administrator access required." }
    });

    await expect(listMentorProfileApprovals()).rejects.toThrow("Prelude administrator access required.");
  });
});

describe("admin mentor approval migration", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260805210000_admin_mentor_profile_approval.sql", import.meta.url),
    "utf8"
  );

  it("checks the authenticated user's database-backed admin role", () => {
    expect(sql).toMatch(/profile\.id\s*=\s*auth\.uid\(\)/i);
    expect(sql).toMatch(/profile\.role\s*=\s*'admin'/i);
    expect(sql).not.toMatch(/raw_user_meta_data|user_metadata/i);
  });

  it("keeps privileged RPCs closed to public and open only to authenticated users", () => {
    expect(sql).toMatch(/revoke all on function public\.admin_list_mentor_profile_approvals\(\) from public/i);
    expect(sql).toMatch(/revoke all on function public\.admin_set_mentor_profile_approval\(uuid, boolean\) from public/i);
    expect(sql).toMatch(/grant execute on function public\.admin_list_mentor_profile_approvals\(\) to authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.admin_set_mentor_profile_approval\(uuid, boolean\) to authenticated/i);
  });

  it("prevents incomplete profiles from being approved", () => {
    expect(sql).toMatch(/p_approved and not exists[\s\S]*mentor\.completed = true/i);
    expect(sql).toContain("Only completed mentor profiles can be approved.");
  });
});
