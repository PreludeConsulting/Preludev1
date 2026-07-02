#!/usr/bin/env node

import assert from "node:assert/strict";
import { createSupabaseParentInvitesMiddleware } from "../../server/supabaseParentInvitesApi.js";
import { resetIpRateLimitBuckets } from "../../server/lib/ipRateLimit.js";

function mockReq(url, method = "GET", body = null, headers = {}) {
  const payload = body ? JSON.stringify(body) : "";
  return {
    method,
    url,
    headers: {
      "content-type": "application/json",
      cookie: "",
      "user-agent": "node-test",
      ...headers
    },
    socket: { remoteAddress: "127.0.0.1" },
    on(event, cb) {
      if (event === "data" && payload) cb(payload);
      if (event === "end") cb();
      return this;
    }
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload ?? "";
    }
  };
  return res;
}

async function invoke(middleware, url, method = "GET", body = null, headers = {}) {
  const req = mockReq(url, method, body, headers);
  const res = mockRes();
  await new Promise((resolve) => {
    middleware(req, res, resolve);
  });
  return {
    status: res.statusCode,
    json: res.body ? JSON.parse(res.body) : null
  };
}

async function main() {
  resetIpRateLimitBuckets();

  const missingConfig = createSupabaseParentInvitesMiddleware({ NODE_ENV: "test" });
  const unavailable = await invoke(missingConfig, "/api/parent-invites/send", "POST", {
    parentEmail: "parent@example.com",
    studentName: "Jordan",
    inviteToken: "abc123def456"
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.error, "parent_invites_unavailable");

  const middleware = createSupabaseParentInvitesMiddleware({
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
  });

  const unauthenticated = await invoke(middleware, "/api/parent-invites/send", "POST", {
    parentEmail: "parent@example.com",
    studentName: "Jordan",
    inviteToken: "abc123def456"
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.json.error, "request_failed");

  const invalidEmail = await invoke(middleware, "/api/parent-invites/send", "POST", {
    parentEmail: "not-an-email",
    studentName: "Jordan",
    inviteToken: "abc123def456"
  });
  assert.equal(invalidEmail.status, 400);
  assert.equal(invalidEmail.json.error, "validation_error");

  const skipped = await invoke(middleware, "/api/other", "GET");
  assert.equal(skipped.status, 200);

  console.log("supabaseParentInvites API tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
