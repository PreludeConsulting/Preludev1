import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/dashboard/context/DashboardDataContext.jsx"),
  "utf8"
);

describe("dashboard motion preference synchronization", () => {
  it("applies server-loaded and successfully saved preferences to the browser motion store", () => {
    expect(source).toContain('savePreferences as persistDashboardPreferences');
    expect(source).toMatch(/const nextPreferences = appData\.settings \|\| data\.preferences;[\s\S]*persistDashboardPreferences\(nextPreferences\)/);
    expect(source).toMatch(/const nextPreferences = result\?\.settings \|\| prefs;[\s\S]*persistDashboardPreferences\(nextPreferences\)/);
  });
});
