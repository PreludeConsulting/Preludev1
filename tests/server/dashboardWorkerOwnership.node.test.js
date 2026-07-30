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
      SUPABASE_ANON_KEY: "anon-key"
    },
    fetch: fetchImpl
  };
}

describe("Cloudflare dashboard ownership", () => {
  it("rejects availability writes unless the authenticated profile is a mentor", async () => {
    let availabilityWriteAttempted = false;
    const fetchImpl = async (url, options = {}) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/auth/v1/user") {
        return jsonResponse({ id: "user-1", email: "student@example.com" });
      }
      if (pathname.includes("/rest/v1/profiles")) {
        return jsonResponse([{ id: "user-1", role: "student", full_name: "Jordan Student" }]);
      }
      if (pathname.includes("/rest/v1/mentor_matching_profiles") && options.method === "POST") {
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
    assert.equal(body.error, "forbidden");
    assert.equal(availabilityWriteAttempted, false);
  });
});
