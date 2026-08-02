import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

describe("dashboard availability ownership", () => {
  it("selects the mentor owner key with availability data in every API runtime", () => {
    const serverApi = read("server/supabaseDashboardApi.js");
    const workerApi = read("functions/_lib/dashboard.js");

    assert.match(
      serverApi,
      /from\("mentor_matching_profiles"\)\.select\("mentor_user_id,availability_schedule"\)\.eq\("mentor_user_id", user\.id\)/
    );
    assert.match(
      workerApi,
      /query\("mentor_matching_profiles", `select=mentor_user_id,availability_schedule&mentor_user_id=eq\.\$\{uid\}&limit=1`\)/
    );
  });
});
