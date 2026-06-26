#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  __resetZoomTokenCacheForTests,
  createZoomMeeting,
  getZoomAccessToken,
  getZoomConfig,
  isZoomConfigured
} from "../../server/lib/zoomService.js";

const originalFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = handler;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

async function testGetZoomConfig() {
  const config = getZoomConfig({
    ZOOM_ACCOUNT_ID: "acct",
    ZOOM_CLIENT_ID: "client",
    ZOOM_CLIENT_SECRET: "secret",
    ZOOM_DEFAULT_TIMEZONE: "America/Chicago"
  });
  assert.equal(config.accountId, "acct");
  assert.equal(config.defaultTimezone, "America/Chicago");
  assert.equal(config.settings.waiting_room, true);
  assert.equal(isZoomConfigured({ ZOOM_ACCOUNT_ID: "a", ZOOM_CLIENT_ID: "b", ZOOM_CLIENT_SECRET: "c" }), true);
  assert.equal(isZoomConfigured({ ZOOM_ACCOUNT_ID: "", ZOOM_CLIENT_ID: "b", ZOOM_CLIENT_SECRET: "c" }), false);
}

async function testTokenFetchAndCache() {
  __resetZoomTokenCacheForTests();
  let tokenCalls = 0;
  mockFetch(async (url, options) => {
    assert.match(String(url), /oauth\/token/);
    assert.match(options.headers.Authorization, /^Basic /);
    tokenCalls += 1;
    return {
      ok: true,
      async json() {
        return { access_token: "token-123", expires_in: 3600 };
      }
    };
  });

  const env = {
    ZOOM_ACCOUNT_ID: "acct",
    ZOOM_CLIENT_ID: "client",
    ZOOM_CLIENT_SECRET: "secret"
  };
  const first = await getZoomAccessToken(env);
  const second = await getZoomAccessToken(env);
  assert.equal(first, "token-123");
  assert.equal(second, "token-123");
  assert.equal(tokenCalls, 1);
  restoreFetch();
}

async function testCreateZoomMeeting() {
  __resetZoomTokenCacheForTests();
  const calls = [];
  mockFetch(async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: options.body });
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
          id: 999001,
          join_url: "https://zoom.us/j/999001",
          start_url: "https://zoom.us/s/999001",
          password: "abc123"
        };
      }
    };
  });

  const env = {
    ZOOM_ACCOUNT_ID: "acct",
    ZOOM_CLIENT_ID: "client",
    ZOOM_CLIENT_SECRET: "secret"
  };

  const result = await createZoomMeeting(
    {
      topic: "Essay review",
      startTime: "2026-07-01T20:00:00.000Z",
      endTime: "2026-07-01T21:00:00.000Z",
      timezone: "America/New_York",
      agenda: "Discuss drafts"
    },
    env
  );

  assert.equal(result.zoomMeetingId, "999001");
  assert.equal(result.joinUrl, "https://zoom.us/j/999001");
  assert.equal(result.startUrl, "https://zoom.us/s/999001");
  assert.equal(result.password, "abc123");
  assert.equal(calls.length, 2);
  const meetingCall = calls[1];
  assert.match(meetingCall.url, /\/users\/me\/meetings$/);
  const payload = JSON.parse(meetingCall.body);
  assert.equal(payload.topic, "Essay review");
  assert.equal(payload.type, 2);
  assert.equal(payload.duration, 60);
  restoreFetch();
}

async function main() {
  await testGetZoomConfig();
  await testTokenFetchAndCache();
  await testCreateZoomMeeting();
  console.log("zoomService.node.test.js passed");
}

main().catch((error) => {
  restoreFetch();
  console.error(error);
  process.exit(1);
});
