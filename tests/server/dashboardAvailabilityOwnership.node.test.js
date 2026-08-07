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
      /adminRest\(context, `mentor_matching_profiles\?select=mentor_user_id,availability_schedule&mentor_user_id=eq\.\$\{uid\}&limit=1`\)/
    );
  });

  it("authorizes by an existing owned mentor identity and never upserts one", () => {
    const serverApi = read("server/supabaseDashboardApi.js");
    const workerApi = read("functions/_lib/dashboard.js");

    assert.match(serverApi, /from\("mentor_matching_profiles"\)[\s\S]*select\("mentor_user_id"\)/);
    assert.match(workerApi, /mentor_matching_profiles\?select=mentor_user_id&mentor_user_id=eq/);
    for (const api of [serverApi, workerApi]) assert.doesNotMatch(api, /\.upsert\([\s\S]{0,300}availability_schedule/);
    assert.match(serverApi, /\.update\(\{[\s\S]*availability_schedule: availability/);
    assert.match(workerApi, /method: "PATCH"[\s\S]*availability_schedule: body/);
  });
});
