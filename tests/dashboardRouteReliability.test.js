import { describe, expect, it } from "vitest";
import {
  dashboardFallbackForRole,
  dashboardLegacyTarget
} from "../src/lib/dashboardRoutes.js";

describe("dashboard route reliability", () => {
  it.each([
    ["student", "resources", "/dashboard/student/help"],
    ["student", "profile", "/dashboard/student/settings"],
    ["student", "mentor-matching", "/dashboard/student/prelude-match"],
    ["mentor", "profile", "/dashboard/mentor/settings"],
    ["mentor", "billing", "/dashboard/mentor/settings"],
    ["parent", "profile", "/dashboard/parent/settings"]
  ])("maps the %s %s alias to a valid absolute route", (role, alias, expected) => {
    expect(dashboardLegacyTarget(role, alias)).toBe(expected);
  });

  it.each([
    ["student", "/dashboard/student/overview"],
    ["mentor", "/dashboard/mentor/overview"],
    ["parent", "/dashboard/parent/overview"],
    ["admin", "/dashboard/admin/matching"]
  ])("provides a valid %s fallback for unknown nested routes", (role, expected) => {
    expect(dashboardFallbackForRole(role)).toBe(expected);
  });

  it("rejects unknown legacy aliases instead of constructing a broken URL", () => {
    expect(dashboardLegacyTarget("student", "unknown")).toBeNull();
  });
});
