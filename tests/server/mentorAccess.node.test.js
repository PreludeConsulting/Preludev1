#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPurchaseSessionsPath,
  buildSubscriptionPath,
  evaluateMentorAccess,
  NO_MENTOR_ACCESS_CODE
} from "../../shared/mentorAccess.js";
import { extractFlexibleSessionCredit } from "../../server/lib/sessionPackageFulfillment.js";
import {
  canRequestMentor,
  creditSessionPackagePurchase,
  listSessionPackagesForStudent
} from "../../server/lib/mentorAccess.js";
import { scheduleMeeting } from "../../server/lib/meetingSchedule.js";
import {
  addDaysToIsoDate,
  getZonedParts,
  zonedDateTimeToUtc
} from "../../shared/mentorBookingSlots.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_STORE = join(__dirname, "../../server/data/session-packages.json");
const MEETING_STORE = join(__dirname, "../../server/data/meetings.json");

const studentId = "11111111-1111-4111-a111-111111111111";
const mentorId = "22222222-2222-4222-a222-222222222222";

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

function resetStores() {
  const dir = dirname(PACKAGE_STORE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PACKAGE_STORE, JSON.stringify({ packages: [] }, null, 2));
  writeFileSync(MEETING_STORE, JSON.stringify({ meetings: [] }, null, 2));
  globalThis.__preludeMentorSchedules = {
    [mentorId]: ALL_DAY_SCHEDULE
  };
}

function futureHourSlot(daysAhead = 2, hour = 10) {
  const parts = getZonedParts(new Date(), "ET");
  const isoDate = addDaysToIsoDate(parts.isoDate, daysAhead);
  const start = `${String(hour).padStart(2, "0")}:00`;
  const end = `${String(hour + 1).padStart(2, "0")}:00`;
  return {
    startTime: zonedDateTimeToUtc(isoDate, start, "ET").toISOString(),
    endTime: zonedDateTimeToUtc(isoDate, end, "ET").toISOString()
  };
}

function futureIso(hoursAhead = 48) {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

function mockReq(headers = {}) {
  return {
    method: "POST",
    url: "/api/meetings",
    headers: {
      "content-type": "application/json",
      ...headers
    }
  };
}

function subscribedStudent(overrides = {}) {
  return {
    id: studentId,
    role: "STUDENT",
    email: "student@example.com",
    plan: "PLUS",
    subscriptionStatus: "active",
    ...overrides
  };
}

async function main() {
  // Force JSON-store path even when a local DATABASE_URL exists in .env.
  process.env.DATABASE_URL = "";
  resetStores();

  // 1) Sessions remaining → can create
  await creditSessionPackagePurchase({
    studentUserId: studentId,
    sessionsPurchased: 2,
    stripeCheckoutSessionId: "cs_test_pkg_1"
  });
  const packageAccess = await canRequestMentor({
    studentId,
    mentorId,
    user: { id: studentId, plan: "basic", subscriptionStatus: "canceled" }
  });
  assert.equal(packageAccess.allowed, true);
  assert.equal(packageAccess.accessType, "session_package");
  assert.equal(packageAccess.remainingSessions, 2);

  const slot1 = futureHourSlot(2, 10);
  const packageMeeting = await scheduleMeeting(
    {
      title: "Package session",
      startTime: slot1.startTime,
      endTime: slot1.endTime,
      status: "pending",
      mentorUserId: mentorId,
      clientRequestId: `pkg-req-${Date.now()}`
    },
    { id: studentId, role: "STUDENT", plan: "basic", subscriptionStatus: "canceled" },
    mockReq({ "Idempotency-Key": `pkg-${Date.now()}` })
  );
  assert.equal(packageMeeting.status, "pending");
  assert.equal(packageMeeting.accessType, "session_package");
  assert.ok(packageMeeting.sessionPackageId);
  const afterPackage = await listSessionPackagesForStudent(studentId);
  assert.equal(afterPackage[0].sessionsRemaining, 1);

  // 2) Active monthly subscription → can create (no package deduct)
  resetStores();
  const subAccess = evaluateMentorAccess({
    user: subscribedStudent(),
    meetings: [],
    packages: []
  });
  assert.equal(subAccess.allowed, true);
  assert.equal(subAccess.accessType, "subscription");

  const slot2 = futureHourSlot(3, 11);
  const subMeeting = await scheduleMeeting(
    {
      title: "Sub session",
      startTime: slot2.startTime,
      endTime: slot2.endTime,
      status: "pending",
      mentorUserId: mentorId,
      clientRequestId: `sub-req-${Date.now()}`
    },
    subscribedStudent(),
    mockReq({ "Idempotency-Key": `sub-${Date.now()}` })
  );
  assert.equal(subMeeting.accessType, "subscription");
  assert.equal(subMeeting.sessionPackageId, null);

  // 3) Neither → blocked
  resetStores();
  const blocked = evaluateMentorAccess({
    user: { id: studentId, plan: "basic", subscriptionStatus: "canceled" },
    meetings: [],
    packages: []
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.accessType, null);

  let blockedThrown = false;
  try {
    await scheduleMeeting(
      {
        title: "Blocked",
        startTime: futureIso(70),
        endTime: futureIso(71),
        status: "pending",
        clientRequestId: `blocked-${Date.now()}`
      },
      { id: studentId, role: "STUDENT", plan: "basic", subscriptionStatus: "canceled" },
      mockReq()
    );
  } catch (error) {
    blockedThrown = true;
    assert.equal(error.code, NO_MENTOR_ACCESS_CODE);
    assert.match(error.message, /available session or an active subscription/i);
  }
  assert.equal(blockedThrown, true);

  // 4) Zero sessions → purchase modal path (same error code for FE)
  assert.equal(blocked.remainingSessions, 0);
  assert.equal(blocked.reason, "no_sessions");

  // 5) Expired / cancelled subscription blocked
  const expired = evaluateMentorAccess({
    user: { id: studentId, plan: "plus", subscriptionStatus: "canceled" },
    meetings: [],
    packages: []
  });
  assert.equal(expired.allowed, false);

  const cancelled = await canRequestMentor({
    studentId,
    user: { id: studentId, plan: "PRO", subscriptionStatus: "cancelled" }
  });
  assert.equal(cancelled.allowed, false);

  // 6) Direct API path rejects without access (already covered by scheduleMeeting throw)

  // 7) Successful package request consumes one session (covered above → remaining 1)

  // 8) Failed request does not consume a session
  resetStores();
  await creditSessionPackagePurchase({
    studentUserId: studentId,
    sessionsPurchased: 1,
    stripeCheckoutSessionId: "cs_test_fail"
  });
  let failedCreate = false;
  try {
    await scheduleMeeting(
      {
        title: "Bad times",
        startTime: futureIso(90),
        endTime: futureIso(80), // end before start
        status: "pending",
        clientRequestId: `fail-${Date.now()}`
      },
      { id: studentId, role: "STUDENT", plan: "basic" },
      mockReq()
    );
  } catch {
    failedCreate = true;
  }
  assert.equal(failedCreate, true);
  const stillOne = await listSessionPackagesForStudent(studentId);
  assert.equal(stillOne[0].sessionsRemaining, 1);

  // 9) Two simultaneous requests cannot consume the same final session
  resetStores();
  await creditSessionPackagePurchase({
    studentUserId: studentId,
    sessionsPurchased: 1,
    stripeCheckoutSessionId: "cs_test_race"
  });
  const results = await Promise.allSettled([
    scheduleMeeting(
      {
        title: "Race A",
        startTime: futureHourSlot(5, 10).startTime,
        endTime: futureHourSlot(5, 10).endTime,
        status: "pending",
        mentorUserId: mentorId,
        clientRequestId: `race-a-${Date.now()}`
      },
      { id: studentId, role: "STUDENT", plan: "basic" },
      mockReq({ "Idempotency-Key": `race-a-${Date.now()}` })
    ),
    scheduleMeeting(
      {
        title: "Race B",
        startTime: futureHourSlot(6, 10).startTime,
        endTime: futureHourSlot(6, 10).endTime,
        status: "pending",
        mentorUserId: mentorId,
        clientRequestId: `race-b-${Date.now()}`
      },
      { id: studentId, role: "STUDENT", plan: "basic" },
      mockReq({ "Idempotency-Key": `race-b-${Date.now()}` })
    )
  ]);
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, NO_MENTOR_ACCESS_CODE);
  const afterRace = await listSessionPackagesForStudent(studentId);
  assert.equal(afterRace[0].sessionsRemaining, 0);

  // 10) Payment links contain mentor / product context
  const purchasePath = buildPurchaseSessionsPath({
    mentorId: "mentor-slug",
    mentorUserId: mentorId
  });
  assert.match(purchasePath, /bundle=flexible_sessions/);
  assert.match(purchasePath, /mentor=mentor-slug/);
  assert.match(purchasePath, /mentorUserId=22222222-2222-4222-a222-222222222222/);
  assert.equal(buildSubscriptionPath(), "/dashboard/student/billing");

  const credit = extractFlexibleSessionCredit({
    id: "cs_test_meta",
    payment_status: "paid",
    metadata: {
      userId: studentId,
      bundleId: "flexible_sessions",
      mentorUserId: mentorId,
      bundleConfig: JSON.stringify({ id: "flexible_sessions", q: { sessions: 5 } })
    }
  });
  assert.equal(credit.sessionsPurchased, 5);
  assert.equal(credit.mentorUserId, mentorId);
  assert.equal(credit.studentUserId, studentId);

  // Subscription preferred over package (no deduct)
  resetStores();
  await creditSessionPackagePurchase({
    studentUserId: studentId,
    sessionsPurchased: 3,
    stripeCheckoutSessionId: "cs_pref"
  });
  const prefer = evaluateMentorAccess({
    user: subscribedStudent(),
    meetings: [],
    packages: await listSessionPackagesForStudent(studentId)
  });
  assert.equal(prefer.accessType, "subscription");
  assert.equal(prefer.packageRemaining, 3);

  console.log("mentorAccess.node.test.js: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
