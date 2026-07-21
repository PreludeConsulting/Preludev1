import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_LINKS } from "../src/data/navLinks.js";
import {
  LANDING_TOP_ID,
  landingRouteForTarget,
  parseLandingTarget
} from "../src/lib/landingNavigation.js";

describe("landing navigation contract", () => {
  it("keeps top navigation on the clean root URL", () => {
    expect(parseLandingTarget("/")).toEqual({ kind: "top", id: LANDING_TOP_ID });
    expect(landingRouteForTarget("/", "/")).toBe("/");
    expect(NAV_LINKS[0]).toMatchObject({ href: "/", scrollTarget: LANDING_TOP_ID });
  });

  it("keeps deliberate section hashes shareable across routes", () => {
    expect(parseLandingTarget("#pricing")).toEqual({ kind: "section", id: "pricing" });
    expect(landingRouteForTarget("#pricing", "/")).toBe("#pricing");
    expect(landingRouteForTarget("#pricing", "/contact")).toBe("/#pricing");
  });

  it("does not classify normal application routes as landing scroll targets", () => {
    expect(parseLandingTarget("/mentors")).toEqual({ kind: "route", id: null });
    expect(landingRouteForTarget("/mentors", "/")).toBe("/mentors");
  });

  it("preserves unknown hashes as section intent so the landing route can safely fall back to top", () => {
    expect(parseLandingTarget("#unknown-section")).toEqual({ kind: "section", id: "unknown-section" });
    expect(landingRouteForTarget("#unknown-section", "/contact")).toBe("/#unknown-section");
  });

  it("contains no placeholder or #home landing links", () => {
    const sourceFiles = [
      "src/data/navLinks.js",
      "src/components/Navbar.jsx",
      "src/components/AppLink.jsx"
    ];
    for (const file of sourceFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/href\s*=\s*["']#["']/);
      expect(source).not.toContain("#home");
    }
  });

  it("renders translated site-search labels instead of undefined item fields", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/SiteSearchPanel.jsx"), "utf8");
    expect(source).toContain("t(item.labelKey)");
    expect(source).not.toContain("{item.label}");
  });

  it("guards landing click interception so modified clicks retain native link behavior", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/AppLink.jsx"), "utf8");
    expect(source).toMatch(/event\.metaKey.*event\.ctrlKey.*event\.shiftKey.*event\.altKey/);
  });
});
