import { describe, expect, it } from "vitest";
import { hasMatchingTeamAccess } from "../shared/matchingTeamAccess.js";

describe("hasMatchingTeamAccess", () => {
  it("allows additive frontend Matching Team fields", () => {
    expect(hasMatchingTeamAccess({ role: "mentor", matchingTeamAccess: true })).toBe(true);
    expect(hasMatchingTeamAccess({ role: "mentor", isMatchingTeam: true })).toBe(true);
  });

  it("allows additive Supabase-style fields", () => {
    expect(hasMatchingTeamAccess({ role: "mentor", matching_team_access: true })).toBe(true);
    expect(hasMatchingTeamAccess({ role: "mentor", is_matching_team: true })).toBe(true);
  });

  it("supports admin system role without changing the main mentor role", () => {
    expect(hasMatchingTeamAccess({ role: "mentor", systemRole: "admin" })).toBe(true);
    expect(hasMatchingTeamAccess({ role: "mentor", system_role: "admin" })).toBe(true);
  });

  it("does not allow a normal mentor", () => {
    expect(hasMatchingTeamAccess({ role: "mentor" })).toBe(false);
  });
});
