import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleDashboard } from "../functions/_lib/dashboard.js";
import { handleMeetings } from "../functions/_lib/meetings.js";

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

  it.each([
    "functions/api/meetings/index.js",
    "functions/api/meetings/[id].js",
    "functions/api/meetings/available-slots.js",
    "functions/api/integrations/index.js",
    "functions/api/integrations/google-calendar/connect.js",
    "functions/api/integrations/google-calendar/disconnect.js",
    "functions/api/integrations/zoom/connect.js",
    "functions/api/integrations/zoom/disconnect.js",
    "functions/api/activities/index.js",
    "functions/api/activities/[[path]].js",
    "functions/api/students/[id].js",
    "functions/api/auth/me.js"
  ])("ships Cloudflare handler %s", (file) => {
    expect(fs.existsSync(path.join(root, file))).toBe(true);
  });

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
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    expect((await response.json()).settings.emailUpdates).toBe(false);
    const write = fetchMock.mock.calls[1];
    expect(write[0]).toContain("user_settings?on_conflict=user_id");
    expect(JSON.parse(write[1].body)).toMatchObject({ user_id: "user-1", email_updates: false });
  });

  it("returns JSON meetings from the Cloudflare meetings handler", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1", email: "student@example.com", user_metadata: { role: "student" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const context = {
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key" },
      request: new Request("https://prelude.test/api/meetings", {
        method: "GET",
        headers: { Authorization: "Bearer user-token", Accept: "application/json" }
      })
    };

    const response = await handleMeetings(context, "index");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/i);
    const body = await response.json();
    expect(body).toEqual({ meetings: [] });
    expect(JSON.stringify(body)).not.toMatch(/<!DOCTYPE|<html/i);
  });
});
