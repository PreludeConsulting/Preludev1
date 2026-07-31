import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token", user: { id: "admin-1" } } },
        error: null
      })
    }
  })
}));

import { loadMatchingTeamQueue } from "../src/lib/mentorSelectionApi.js";

describe("Matching Team API response handling", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("rejects the Cloudflare SPA fallback instead of displaying zero students", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    })));

    await expect(loadMatchingTeamQueue()).rejects.toMatchObject({
      status: 502,
      payload: { error: "matching_api_invalid_response" }
    });
  });

  it("renders configuration failures as errors instead of an empty queue", () => {
    const source = fs.readFileSync("src/dashboard/pages/admin/AdminPages.jsx", "utf8");
    expect(source).toContain('role="alert">{error}');
    expect(source).toContain('{error ? "—" : filteredStudents.length}');
    expect(source).toContain("!error && !filteredStudents.length");
  });
});
