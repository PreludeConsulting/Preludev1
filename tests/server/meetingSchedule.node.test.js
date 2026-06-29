#!/usr/bin/env node

import assert from "node:assert/strict";
import { createDashboardApiMiddleware } from "../../server/dashboardApi.js";
import { scheduleMeeting, updateScheduledMeeting } from "../../server/lib/meetingSchedule.js";

const mentorUser = {
  id: "22222222-2222-2222-2222-222222222222",
  role: "MENTOR",
  email: "mentor@example.com"
};
const studentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  role: "STUDENT",
  email: "student@example.com"
};

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

function futureIso(hoursAhead = 48) {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

async function main() {
  delete process.env.DATABASE_URL;

  const startTime = futureIso(72);
  const endTime = futureIso(73);
  const zoomJoinUrl = "https://zoom.us/j/5551234567";

  const pending = await scheduleMeeting(
    {
      title: "Essay help",
      startTime,
      endTime,
      status: "pending",
      meetingType: "zoom",
      clientRequestId: `dup-key-${Date.now()}`
    },
    studentUser,
    mockReq("/api/meetings", "POST", null, { "Idempotency-Key": "student-pending" })
  );
  assert.equal(pending.status, "pending");
  assert.equal(pending.zoomJoinUrl, null);

  let mentorCreateFailed = false;
  try {
    await scheduleMeeting(
      {
        title: "Missing link",
        startTime,
        endTime,
        meetingType: "zoom",
        status: "scheduled"
      },
      mentorUser,
      mockReq("/api/meetings", "POST")
    );
  } catch (error) {
    mentorCreateFailed = true;
    assert.match(error.message, /Zoom meeting link/i);
  }
  assert.equal(mentorCreateFailed, true);

  const scheduled = await scheduleMeeting(
    {
      title: "Essay review",
      startTime,
      endTime,
      meetingType: "zoom",
      status: "scheduled",
      zoomJoinUrl
    },
    mentorUser,
    mockReq("/api/meetings", "POST")
  );
  assert.equal(scheduled.zoomJoinUrl, zoomJoinUrl);

  const googleMeetUrl = "https://meet.google.com/abc-defg-hij";
  const googleScheduled = await scheduleMeeting(
    {
      title: "Google Meet review",
      startTime,
      endTime,
      meetingType: "google_meet",
      status: "scheduled",
      zoomJoinUrl: googleMeetUrl
    },
    mentorUser,
    mockReq("/api/meetings", "POST")
  );
  assert.equal(googleScheduled.meetingType, "google_meet");
  assert.equal(googleScheduled.zoomJoinUrl, googleMeetUrl);

  const approved = await updateScheduledMeeting(
    pending.id,
    { status: "scheduled", zoomJoinUrl },
    mentorUser
  );
  assert.equal(approved.status, "scheduled");
  assert.equal(approved.zoomJoinUrl, zoomJoinUrl);

  const authedMiddleware = createDashboardApiMiddleware(async () => ({ user: studentUser }));
  const unauthorizedMiddleware = createDashboardApiMiddleware(async () => null);
  const unauthorized = await new Promise((resolve) => {
    const req = mockReq("/api/meetings", "POST", { title: "Test", startTime, endTime });
    const res = mockRes();
    unauthorizedMiddleware(req, res, resolve);
  });
  assert.equal(unauthorized.statusCode, 401);

  console.log("meetingSchedule.node.test.js passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
