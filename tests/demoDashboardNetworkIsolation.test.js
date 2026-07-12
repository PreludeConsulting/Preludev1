import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/dashboard/context/DashboardDataContext.jsx"),
  "utf8"
);

describe("demo dashboard network isolation", () => {
  it("returns demo data before calling authenticated dashboard APIs", () => {
    const demoGuard = source.indexOf("if (localDemo) {");
    const nonSupabaseRequest = source.indexOf("const data = await getDashboardAppData();", source.indexOf("const store = localDemo"));
    expect(demoGuard).toBeGreaterThan(source.indexOf("const store = localDemo"));
    expect(demoGuard).toBeLessThan(nonSupabaseRequest);
    expect(source.slice(demoGuard, nonSupabaseRequest)).toContain("return;");
  });
});
