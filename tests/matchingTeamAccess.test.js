import { describe, expect, it } from "vitest";
import { hasMatchingTeamAccess } from "../shared/matchingTeamAccess.js";

describe("hasMatchingTeamAccess", () => {
  it("ignores client-writable Matching Team booleans", () => {
    expect(hasMatchingTeamAccess({ role: "mentor", matchingTeamAccess: true })).toBe(false);
    expect(hasMatchingTeamAccess({ role: "mentor", isMatchingTeam: true })).toBe(false);
    expect(hasMatchingTeamAccess({ role: "mentor", matching_team_access: true })).toBe(false);
    expect(hasMatchingTeamAccess({ role: "mentor", is_matching_team: true })).toBe(false);
  });

  it("supports admin system role without changing the main mentor role", () => {
    expect(hasMatchingTeamAccess({ role: "mentor", systemRole: "admin" })).toBe(true);
    expect(hasMatchingTeamAccess({ role: "mentor", system_role: "admin" })).toBe(true);
    expect(hasMatchingTeamAccess({ role: "admin" })).toBe(true);
  });

  it("does not allow a normal mentor", () => {
    expect(hasMatchingTeamAccess({ role: "mentor" })).toBe(false);
  });
});
