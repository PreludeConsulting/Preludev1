import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleDashboard } from "../../functions/_lib/dashboard.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function dashboardContext({ method = "PUT", action = "availability", body = null, fetchImpl }) {
  return {
    request: new Request(`https://example.com/api/dashboard/${action}`, {
      method,
      headers: {
        Authorization: "Bearer user-token",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    }),
    env: {
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    },
    fetch: fetchImpl
  };
}

describe("Cloudflare dashboard ownership", () => {
  it("keeps app-data available when linked collection rows are visible", async () => {
    const fetchImpl = async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/auth/v1/user") {
        return jsonResponse({ id: "mentor-1", email: "mentor@example.com" });
      }
      if (pathname.includes("/rest/v1/profiles")) {
        return jsonResponse([{ id: "mentor-1", role: "mentor", full_name: "Hyunbin Mentor", email: "mentor@example.com" }]);
      }
      if (pathname.includes("/rest/v1/user_settings")) {
        return jsonResponse([{ user_id: "mentor-1", email_updates: true }]);
      }
      if (pathname.includes("/rest/v1/mentor_matching_profiles")) {
        return jsonResponse([{ mentor_user_id: "mentor-1", availability_schedule: { timezone: "ET", days: [] } }]);
      }
      if (pathname.includes("/rest/v1/reward_wallets")) {
        return jsonResponse([{ user_id: "mentor-1", coin_balance: 0 }]);
      }
      if (pathname.includes("/rest/v1/reward_task_instances")) {
        return jsonResponse([]);
      }
      if (pathname.includes("/rest/v1/notifications")) {
        return jsonResponse([{ id: "n1", user_id: "mentor-1", title: "Welcome", body: "Hi", unread: true }]);
      }
      if (pathname.includes("/rest/v1/calendar_events")) {
        return jsonResponse([
          { id: "e1", user_id: "student-1", title: "Session", start_time: "2026-08-01T15:00:00Z", end_time: "2026-08-01T16:00:00Z" }
        ]);
      }
      if (pathname.includes("/rest/v1/messages")) {
        return jsonResponse([
          { id: "m1", sender_id: "student-1", receiver_id: "parent-1", user_id: "student-1", body: "thread note" }
        ]);
      }
      return jsonResponse([]);
    };

    const response = await handleDashboard(
      dashboardContext({
        method: "GET",
        action: "app-data",
        fetchImpl
      }),
      "app-data"
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.user.id, "mentor-1");
    assert.equal(body.events.length, 1);
    assert.equal(body.messages.length, 1);
    assert.equal(body.notifications.length, 1);
  });

  it("rejects availability writes when the authenticated user has no mentor profile", async () => {
    let availabilityWriteAttempted = false;
    const fetchImpl = async (url, options = {}) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/auth/v1/user") {
        return jsonResponse({ id: "user-1", email: "student@example.com" });
      }
      if (pathname.includes("/rest/v1/mentor_matching_profiles") && options.method === "PATCH") {
        availabilityWriteAttempted = true;
        return jsonResponse([{ mentor_user_id: "user-1", availability_schedule: { timezone: "ET", days: [] } }]);
      }
      return jsonResponse([]);
    };

    const response = await handleDashboard(
      dashboardContext({
        fetchImpl,
        body: { timezone: "ET", days: [] }
      }),
      "availability"
    );
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "mentor_profile_required");
    assert.equal(availabilityWriteAttempted, false);
  });
});
