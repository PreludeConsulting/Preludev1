import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleDashboard } from "../functions/_lib/dashboard.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("deployed dashboard persistence routes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["app-data", "profile", "settings", "availability"])(
    "ships the %s endpoint on Cloudflare and Vercel",
    (route) => {
      expect(fs.existsSync(path.join(root, `functions/api/dashboard/${route}.js`))).toBe(true);
      expect(fs.existsSync(path.join(root, `api/dashboard/${route}.js`))).toBe(true);
    }
  );

  it("routes every Cloudflare dashboard endpoint through the shared persistence handler", () => {
    for (const route of ["app-data", "profile", "settings", "availability"]) {
      expect(read(`functions/api/dashboard/${route}.js`)).toContain("handleDashboard");
    }
  });

  it("persists authenticated settings through the Cloudflare endpoint", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1", email: "student@example.com" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: "user-1", email_updates: false }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const context = {
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key" },
      request: new Request("https://prelude.test/api/dashboard/settings", {
        method: "PATCH",
        headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
        body: JSON.stringify({ email_updates: false, user_id: "forged-user" })
      })
    };

    const response = await handleDashboard(context, "settings");
    expect(response.status).toBe(200);
    expect((await response.json()).settings.emailUpdates).toBe(false);
    const write = fetchMock.mock.calls[1];
    expect(write[0]).toContain("user_settings?on_conflict=user_id");
    expect(JSON.parse(write[1].body)).toMatchObject({ user_id: "user-1", email_updates: false });
  });
});
