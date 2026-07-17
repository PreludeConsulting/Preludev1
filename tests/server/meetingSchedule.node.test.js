#!/usr/bin/env node

import assert from "node:assert/strict";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDashboardApiMiddleware } from "../../server/dashboardApi.js";
import { scheduleMeeting, updateScheduledMeeting } from "../../server/lib/meetingSchedule.js";
import {
  addDaysToIsoDate,
  getZonedParts,
  zonedDateTimeToUtc
} from "../../shared/mentorBookingSlots.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEETING_STORE = join(__dirname, "../../server/data/meetings.json");

const mentorUser = {
  id: "22222222-2222-4222-a222-222222222222",
  role: "MENTOR",
  email: "mentor@example.com"
};
const studentUser = {
  id: "11111111-1111-4111-a111-111111111111",
  role: "STUDENT",
  email: "student@example.com",
  plan: "PLUS",
  subscriptionStatus: "active"
};

const ALL_DAY_SCHEDULE = {
  timezone: "ET",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
    (dayOfWeek) => ({
      dayOfWeek,
      enabled: true,
      startTime: "00:00",
      endTime: "23:59"
    })
  )
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

function futureHourSlot(daysAhead = 2, hour = 10) {
  const parts = getZonedParts(new Date(), "ET");
  const isoDate = addDaysToIsoDate(parts.isoDate, daysAhead);
  const startTime = `${String(hour).padStart(2, "0")}:00`;
  const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
  return {
    startTime: zonedDateTimeToUtc(isoDate, startTime, "ET").toISOString(),
    endTime: zonedDateTimeToUtc(isoDate, endTime, "ET").toISOString()
  };
}

async function main() {
  process.env.DATABASE_URL = "";
  const dir = dirname(MEETING_STORE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(MEETING_STORE, JSON.stringify({ meetings: [] }, null, 2));
  globalThis.__preludeMentorSchedules = {
    [mentorUser.id]: ALL_DAY_SCHEDULE
  };

  const slot = futureHourSlot(3, 10);
  const startTime = slot.startTime;
  const endTime = slot.endTime;
  const zoomJoinUrl = "https://zoom.us/j/5551234567";

  const pending = await scheduleMeeting(
    {
      title: "Essay help",
      startTime,
      endTime,
      status: "pending",
      meetingType: "zoom",
      mentorUserId: mentorUser.id,
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
  const googleSlot = futureHourSlot(4, 11);
  const googleScheduled = await scheduleMeeting(
    {
      title: "Google Meet review",
      startTime: googleSlot.startTime,
      endTime: googleSlot.endTime,
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

  // Second student cannot take the same pending/scheduled slot once held.
  let conflictFailed = false;
  try {
    await scheduleMeeting(
      {
        title: "Conflict",
        startTime,
        endTime,
        status: "pending",
        meetingType: "zoom",
        mentorUserId: mentorUser.id,
        clientRequestId: `conflict-${Date.now()}`
      },
      {
        ...studentUser,
        id: "33333333-3333-4333-a333-333333333333"
      },
      mockReq("/api/meetings", "POST")
    );
  } catch (error) {
    conflictFailed = true;
    assert.equal(error.code, "slot_taken");
  }
  assert.equal(conflictFailed, true);

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
