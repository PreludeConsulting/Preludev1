#!/usr/bin/env node

import assert from "node:assert/strict";
import { createAuthApiMiddleware } from "../../server/authApi.js";

function mockReq(url, method = "GET", body = null) {
  const payload = body ? JSON.stringify(body) : "";
  return {
    method,
    url,
    headers: {
      "content-type": "application/json",
      cookie: "",
      "user-agent": "node-test"
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

async function invoke(middleware, url, method = "GET", body = null) {
  const req = mockReq(url, method, body);
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
  const middleware = createAuthApiMiddleware();

  const missingVerifyToken = await invoke(middleware, "/api/auth/verify-email", "GET");
  assert.equal(missingVerifyToken.status, 400);
  assert.match(missingVerifyToken.json.message, /invalid|expired/i);

  const registerMissingRole = await invoke(middleware, "/api/auth/register", "POST", {
    firstName: "Test",
    lastName: "User",
    email: "missing-role@example.com",
    password: "ValidPass123!",
    termsAccepted: true
  });
  assert.equal(registerMissingRole.status, 400);
  assert.equal(registerMissingRole.json.error, "validation_error");

  const resetMissingToken = await invoke(middleware, "/api/auth/reset-password", "POST", {
    token: "short",
    password: "AnotherValid1!"
  });
  assert.equal(resetMissingToken.status, 400);
  assert.equal(resetMissingToken.json.error, "validation_error");

  const forgotPassword = await invoke(middleware, "/api/auth/request-reset", "POST", {
    email: "nobody@example.com"
  });
  assert.equal(forgotPassword.status, 200);
  assert.match(forgotPassword.json.message, /If an account exists with this email/i);

  console.log("authApi validation tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
