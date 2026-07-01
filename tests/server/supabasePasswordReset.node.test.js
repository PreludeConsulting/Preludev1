#!/usr/bin/env node

import assert from "node:assert/strict";
import { createSupabasePasswordResetMiddleware } from "../../server/supabasePasswordResetApi.js";

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
  const middleware = createSupabasePasswordResetMiddleware({
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
  });

  const missingConfig = createSupabasePasswordResetMiddleware({ NODE_ENV: "test" });
  const unavailable = await invoke(missingConfig, "/api/auth/request-password-reset", "POST", {
    email: "student@example.com"
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.error, "password_reset_unavailable");

  const invalidEmail = await invoke(middleware, "/api/auth/request-password-reset", "POST", {
    email: "not-an-email"
  });
  assert.equal(invalidEmail.status, 400);
  assert.equal(invalidEmail.json.error, "validation_error");

  console.log("supabasePasswordReset API tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
