#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDashboardApiMiddleware } from "../../server/dashboardApi.js";
import { scheduleMeeting, updateScheduledMeeting } from "../../server/lib/meetingSchedule.js";
import { __resetZoomTokenCacheForTests } from "../../server/lib/zoomService.js";

const originalFetch = globalThis.fetch;
const originalDatabaseUrl = process.env.DATABASE_URL;

function mockFetch(handler) {
  globalThis.fetch = handler;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

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

function futureIso(hoursAhead = 48) {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

async function main() {
  delete process.env.DATABASE_URL;
  process.env.ZOOM_ACCOUNT_ID = "acct";
  process.env.ZOOM_CLIENT_ID = "client";
  process.env.ZOOM_CLIENT_SECRET = "secret";
  __resetZoomTokenCacheForTests();

  mockFetch(async (url) => {
    if (String(url).includes("/oauth/token")) {
      return {
        ok: true,
        async json() {
          return { access_token: "token-123", expires_in: 3600 };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          id: 424242,
          join_url: "https://zoom.us/j/424242",
          start_url: "https://zoom.us/s/424242",
          password: "pw"
        };
      }
    };
  });

  const studentUser = {
    id: "11111111-1111-1111-1111-111111111111",
    role: "STUDENT",
    email: "student@example.com"
  };
  const mentorUser = {
    id: "22222222-2222-2222-2222-222222222222",
    role: "MENTOR",
    email: "mentor@example.com"
  };

  const startTime = futureIso(72);
  const endTime = futureIso(73);

  const idempotencyKey = `dup-key-${Date.now()}`;

  const pending = await scheduleMeeting(
    {
      title: "Essay help",
      startTime,
      endTime,
      status: "pending",
      meetingType: "zoom",
      clientRequestId: idempotencyKey
    },
    studentUser,
    mockReq("/api/meetings", "POST", null, { "Idempotency-Key": idempotencyKey })
  );
  assert.equal(pending.status, "pending");
  assert.equal(pending.zoomJoinUrl, null);

  const duplicate = await scheduleMeeting(
    {
      title: "Essay help",
      startTime,
      endTime,
      status: "pending",
      meetingType: "zoom",
      clientRequestId: idempotencyKey
    },
    studentUser,
    mockReq("/api/meetings", "POST", null, { "Idempotency-Key": idempotencyKey })
  );
  assert.equal(duplicate.id, pending.id);

  const scheduled = await updateScheduledMeeting(
    pending.id,
    { status: "scheduled" },
    mentorUser
  );
  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.zoomJoinUrl, "https://zoom.us/j/424242");

  const authedMiddleware = createDashboardApiMiddleware(async () => ({ user: studentUser }));
  const unauthorizedMiddleware = createDashboardApiMiddleware(async () => null);
  const unauthorized = await invoke(unauthorizedMiddleware, "/api/meetings", "POST", {
    title: "Test",
    startTime,
    endTime
  });
  assert.equal(unauthorized.status, 401);

  const invalidTime = await invoke(authedMiddleware, "/api/meetings", "POST", {
    title: "Bad time",
    startTime: endTime,
    endTime: startTime
  });
  assert.equal(invalidTime.status, 400);

  restoreFetch();
  if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  console.log("meetingSchedule.node.test.js passed");
}

main().catch((error) => {
  restoreFetch();
  if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  console.error(error);
  process.exit(1);
});
