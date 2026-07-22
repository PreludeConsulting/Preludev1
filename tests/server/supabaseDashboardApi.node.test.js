import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSupabaseDashboardApiMiddleware } from "../../server/supabaseDashboardApi.js";

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

function request(method = "GET", url = "/api/dashboard/app-data", body = null) {
  return {
    method,
    url,
    headers: { authorization: "Bearer test-token" },
    on(event, callback) {
      if (event === "data" && body) callback(JSON.stringify(body));
      if (event === "end") callback();
    }
  };
}

function statefulSupabase(initial) {
  const rows = structuredClone(initial);
  return {
    from(table) {
      const builder = {
        operation: "read",
        payload: null,
        select() { return builder; },
        eq() { return builder; },
        order() { return builder; },
        or() { return builder; },
        update(payload) { builder.operation = "update"; builder.payload = payload; return builder; },
        upsert(payload) { builder.operation = "upsert"; builder.payload = payload; return builder; },
        maybeSingle() {
          if (builder.operation !== "read") rows[table] = { ...(rows[table] || {}), ...builder.payload };
          return Promise.resolve({ data: rows[table] ?? null, error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: Array.isArray(rows[table]) ? rows[table] : [], error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

function fakeSupabase(rows) {
  return {
    from(table) {
      const state = { table };
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        or() { return builder; },
        maybeSingle() { return Promise.resolve({ data: rows[table] ?? null, error: null }); },
        then(resolve, reject) {
          return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve, reject);
        },
        update(payload) { state.payload = payload; return builder; },
        upsert(payload) { state.payload = payload; return builder; }
      };
      return builder;
    }
  };
}

describe("Supabase dashboard API", () => {
  it("isolates rewards and availability schema failures from core dashboard data", async () => {
    const rows = {
      profiles: { id: "user-1", full_name: "Jordan Student", role: "student" },
      user_settings: { user_id: "user-1" },
      notifications: [],
      calendar_events: [],
      messages: []
    };
    const featureTables = new Set(["mentor_matching_profiles", "reward_wallets", "reward_task_instances"]);
    const supabase = {
      from(table) {
        const builder = {
          select() { return builder; }, eq() { return builder; }, order() { return builder; }, or() { return builder; },
          maybeSingle() {
            return Promise.resolve(featureTables.has(table)
              ? { data: null, error: { message: `missing ${table}` } }
              : { data: rows[table] ?? null, error: null });
          },
          then(resolve, reject) {
            return Promise.resolve(featureTables.has(table)
              ? { data: null, error: { message: `missing ${table}` } }
              : { data: rows[table] ?? [], error: null }).then(resolve, reject);
          }
        };
        return builder;
      }
    };
    const middleware = createSupabaseDashboardApiMiddleware({
      requireUser: async () => ({ user: { id: "user-1", email: "student@example.com" }, supabase })
    });
    const res = response();
    await middleware(request(), res, () => assert.fail("app-data should be handled"));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.profile.fullName, "Jordan Student");
    assert.deepEqual(res.body.availability.days, []);
    assert.equal(res.body.rewards.coins, 0);
    assert.deepEqual(res.body.featureErrors.sort(), ["availability", "rewards"]);
  });

  it("returns normalized authenticated app data instead of the legacy 404 payload", async () => {
    const middleware = createSupabaseDashboardApiMiddleware({
      requireUser: async () => ({
        user: { id: "user-1", email: "student@example.com", user_metadata: { role: "student" } },
        supabase: fakeSupabase({
          profiles: { id: "user-1", full_name: "Jordan Student", role: "student" },
          user_settings: { user_id: "user-1", email_updates: false },
          mentor_matching_profiles: { mentor_user_id: "user-1", availability_schedule: { days: [] } },
          reward_wallets: { user_id: "user-1", coin_balance: 18, lifetime_earned: 24 },
          reward_task_instances: [{ id: "task-1", status: "claimed", coin_value: 6 }],
          notifications: []
        })
      })
    });
    const res = response();
    await middleware(request(), res, () => assert.fail("app-data should be handled"));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.id, "user-1");
    assert.equal(res.body.profile.fullName, "Jordan Student");
    assert.equal(res.body.settings.emailUpdates, false);
    assert.equal(res.body.rewards.coins, 18);
    assert.equal(res.body.rewards.lifetimeEarned, 24);
    assert.deepEqual(res.body.availability.days, []);
  });

  it("does not claim a mutation succeeded when Supabase returns an error", async () => {
    const middleware = createSupabaseDashboardApiMiddleware({
      requireUser: async () => ({
        user: { id: "user-1" },
        supabase: {
          from() {
            const builder = {
              update() { return builder; },
              eq() { return builder; },
              select() { return builder; },
              maybeSingle() { return Promise.resolve({ data: null, error: { message: "write failed" } }); }
            };
            return builder;
          }
        }
      })
    });
    const res = response();
    await middleware(request("PATCH", "/api/dashboard/profile"), res, () => assert.fail("profile should be handled"));
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "dashboard_sync_failed");
    assert.equal(res.body.message, "Dashboard data is temporarily unavailable. Retry in a moment.");
    assert.doesNotMatch(res.body.message, /write failed/i);
  });

  it("rejects availability writes unless the authenticated profile is a mentor", async () => {
    let availabilityWriteAttempted = false;
    const supabase = {
      from(table) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          upsert() { availabilityWriteAttempted = true; return builder; },
          maybeSingle() {
            return Promise.resolve({
              data: table === "profiles" ? { role: "student" } : null,
              error: null
            });
          }
        };
        return builder;
      }
    };
    const middleware = createSupabaseDashboardApiMiddleware({
      requireUser: async () => ({ user: { id: "user-1" }, supabase })
    });
    const res = response();

    await middleware(request("PUT", "/api/dashboard/availability", {
      timezone: "ET",
      days: []
    }), res, () => assert.fail("availability should be handled"));

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "forbidden");
    assert.equal(availabilityWriteAttempted, false);
  });

  it("persists profile, settings, and availability mutations across a subsequent app-data read", async () => {
    const supabase = statefulSupabase({
      profiles: { id: "user-1", full_name: "Before", role: "mentor" },
      user_settings: { user_id: "user-1", email_updates: true },
      mentor_matching_profiles: { mentor_user_id: "user-1", availability_schedule: { timezone: "ET", days: [] } },
      reward_wallets: { user_id: "user-1", coin_balance: 4 },
      reward_task_instances: [],
      notifications: [],
      calendar_events: [],
      messages: []
    });
    const requireUser = async () => ({ user: { id: "user-1", email: "mentor@example.com" }, supabase });
    const middleware = createSupabaseDashboardApiMiddleware({ requireUser });
    const profileResponse = response();
    await middleware(request("PATCH", "/api/dashboard/profile", { full_name: "After" }), profileResponse, () => {});
    assert.equal(profileResponse.statusCode, 200);
    assert.equal(profileResponse.body.profile.fullName, "After");

    const settingsResponse = response();
    await middleware(request("PATCH", "/api/dashboard/settings", { email_updates: false }), settingsResponse, () => {});
    assert.equal(settingsResponse.statusCode, 200);
    assert.equal(settingsResponse.body.settings.emailUpdates, false);

    const availabilityResponse = response();
    await middleware(request("PUT", "/api/dashboard/availability", {
      timezone: "ET",
      days: [{ dayOfWeek: "Monday", enabled: true, startTime: "09:00", endTime: "12:00" }]
    }), availabilityResponse, () => {});
    assert.equal(availabilityResponse.statusCode, 200);

    const appDataResponse = response();
    await middleware(request(), appDataResponse, () => {});
    assert.equal(appDataResponse.statusCode, 200);
    assert.equal(appDataResponse.body.profile.fullName, "After");
    assert.equal(appDataResponse.body.settings.emailUpdates, false);
    assert.equal(appDataResponse.body.availability.days[0].dayOfWeek, "Monday");
  });
});
