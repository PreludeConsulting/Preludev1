import { describe, expect, it } from "vitest";
import {
  APP_ACTION_MAP,
  DASHBOARD_ROUTE_BASES,
  LANDING_SECTION_TARGETS,
  PUBLIC_APP_ROUTES
} from "../shared/appRouteRegistry.js";

describe("application route and action registry", () => {
  it("contains no dead placeholder or home-hash target", () => {
    const targets = [
      ...Object.values(PUBLIC_APP_ROUTES),
      ...Object.values(LANDING_SECTION_TARGETS),
      ...Object.values(DASHBOARD_ROUTE_BASES),
      ...Object.values(APP_ACTION_MAP).map((action) => action.target)
    ];
    expect(targets).not.toContain("#");
    expect(targets).not.toContain("#home");
    expect(targets.every((target) => target.startsWith("/") || /^#[a-z][\w-]+$/.test(target))).toBe(true);
  });

  it("keeps top actions hash-free and deliberate sections shareable", () => {
    expect(APP_ACTION_MAP.go_home).toEqual({ kind: "top", target: "/" });
    expect(APP_ACTION_MAP.explore_plans).toEqual({ kind: "section", target: "#pricing" });
    expect(APP_ACTION_MAP.open_dashboard).toEqual({ kind: "route", target: "/dashboard" });
  });
});
