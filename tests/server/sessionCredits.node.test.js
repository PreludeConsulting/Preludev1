/**
 * Authoritative Plus/Pro session-credit lifecycle tests.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateMentorAccess } from "../../shared/mentorAccess.js";
import { scheduleMeeting, updateScheduledMeeting } from "../../server/lib/meetingSchedule.js";
import {
  activateSessionPeriodFromPayment,
  expireSessionPeriodsAtPeriodEnd,
  getSessionCreditSummary,
  grantSessionCreditsFromPaidInvoice
} from "../../server/lib/sessionCredits.js";
import {
  addDaysToIsoDate,
  getZonedParts,
  zonedDateTimeToUtc
} from "../../shared/mentorBookingSlots.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERIOD_STORE = join(__dirname, "../../server/data/subscription-session-periods.json");
const MEETING_STORE = join(__dirname, "../../server/data/meetings.json");
const PACKAGE_STORE = join(__dirname, "../../server/data/session-packages.json");

const studentPlus = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const studentPro = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const mentorId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
  const dir = dirname(PERIOD_STORE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PERIOD_STORE, JSON.stringify({ periods: [], reservations: [] }, null, 2));
  writeFileSync(MEETING_STORE, JSON.stringify({ meetings: [] }, null, 2));
  writeFileSync(PACKAGE_STORE, JSON.stringify({ packages: [] }, null, 2));
  globalThis.__preludeMentorSchedules = { [mentorId]: ALL_DAY_SCHEDULE };
}

function periodBounds(days = 28) {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
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

function mockReq(headers = {}) {
  return {
    method: "POST",
    url: "/api/meetings",
    headers: { "content-type": "application/json", ...headers }
  };
}

function userFor(id, plan) {
  return {
    id,
    role: "STUDENT",
    plan: plan.toUpperCase(),
    subscriptionStatus: "active"
  };
}

async function book(studentId, plan, hour, key) {
  // Production permits one Book a Session request per calendar day.
  const slot = futureHourSlot(2 + hour, 8 + (hour % 12));
  return scheduleMeeting(
    {
      title: `Session ${key}`,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: "pending",
      mentorUserId: mentorId,
      clientRequestId: key
    },
    userFor(studentId, plan),
    mockReq({ "Idempotency-Key": key })
  );
}

function ageMeetingRequests() {
  const store = JSON.parse(readFileSync(MEETING_STORE, "utf8"));
  const previousDay = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  store.meetings = (store.meetings || []).map((meeting) => ({
    ...meeting,
    createdAt: previousDay
  }));
  writeFileSync(MEETING_STORE, JSON.stringify(store, null, 2));
}

async function main() {
  process.env.DATABASE_URL = "";
  process.env.NODE_ENV = "test";
  resetStores();

  // --- BOOKING: Pro ---
  {
    const bounds = periodBounds();
    await activateSessionPeriodFromPayment({
      studentUserId: studentPro,
      planId: "pro",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      stripeInvoiceId: "in_pro_start",
      idempotencyKey: "session-period:invoice:in_pro_start"
    });
    let summary = await getSessionCreditSummary(studentPro);
    assert.equal(summary.remaining, 4);
    assert.equal(summary.allowance, 4);
    assert.equal(
      evaluateMentorAccess({
        user: userFor(studentPro, "pro"),
        sessionCredits: summary
      }).sessionCreditBalanceLabel,
      "4 of 4 session credits remaining"
    );

    await book(studentPro, "pro", 1, `pro-book-1-${Date.now()}`);
    ageMeetingRequests();
    summary = await getSessionCreditSummary(studentPro);
    assert.equal(summary.remaining, 3);

    await book(studentPro, "pro", 2, `pro-book-2-${Date.now()}`);
    ageMeetingRequests();
    await book(studentPro, "pro", 3, `pro-book-3-${Date.now()}`);
    ageMeetingRequests();
    await book(studentPro, "pro", 4, `pro-book-4-${Date.now()}`);
    ageMeetingRequests();
    summary = await getSessionCreditSummary(studentPro);
    assert.equal(summary.remaining, 0);

    let rejected = false;
    try {
      await book(studentPro, "pro", 5, `pro-book-5-${Date.now()}`);
    } catch (error) {
      rejected = true;
      assert.match(error.message, /no session credits remaining/i);
      assert.equal(error.code, "NO_SESSION_CREDITS");
    }
    assert.equal(rejected, true);
    summary = await getSessionCreditSummary(studentPro);
    assert.equal(summary.remaining, 0);
  }

  // --- BOOKING: Plus ---
  resetStores();
  {
    const bounds = periodBounds();
    await activateSessionPeriodFromPayment({
      studentUserId: studentPlus,
      planId: "plus",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      stripeInvoiceId: "in_plus_start"
    });
    let summary = await getSessionCreditSummary(studentPlus);
    assert.equal(summary.remaining, 2);
    assert.equal(summary.allowance, 2);

    await book(studentPlus, "plus", 1, `plus-book-1-${Date.now()}`);
    ageMeetingRequests();
    summary = await getSessionCreditSummary(studentPlus);
    assert.equal(summary.remaining, 1);

    await book(studentPlus, "plus", 2, `plus-book-2-${Date.now()}`);
    ageMeetingRequests();
    summary = await getSessionCreditSummary(studentPlus);
    assert.equal(summary.remaining, 0);

    let rejected = false;
    try {
      await book(studentPlus, "plus", 3, `plus-book-3-${Date.now()}`);
    } catch (error) {
      rejected = true;
      assert.match(error.message, /no session credits remaining/i);
    }
    assert.equal(rejected, true);
  }

  // --- Invalid form / failed booking does not deduct ---
  resetStores();
  {
    const bounds = periodBounds();
    await activateSessionPeriodFromPayment({
      studentUserId: studentPro,
      planId: "pro",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      stripeInvoiceId: "in_pro_invalid"
    });
    let failed = false;
    try {
      await scheduleMeeting(
        {
          title: "",
          startTime: futureHourSlot(2, 9).startTime,
          endTime: futureHourSlot(2, 9).endTime,
          status: "pending",
          mentorUserId: mentorId,
          clientRequestId: `invalid-${Date.now()}`
        },
        userFor(studentPro, "pro"),
        mockReq()
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    assert.equal((await getSessionCreditSummary(studentPro)).remaining, 4);
  }

  // --- Double-click / duplicate idempotency does not deduct twice ---
  resetStores();
  {
    const bounds = periodBounds();
    await activateSessionPeriodFromPayment({
      studentUserId: studentPro,
      planId: "pro",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      stripeInvoiceId: "in_pro_dup"
    });
    const key = `pro-dup-${Date.now()}`;
    const first = await book(studentPro, "pro", 1, key);
    const second = await book(studentPro, "pro", 1, key);
    assert.equal(first.id, second.id);
    assert.equal((await getSessionCreditSummary(studentPro)).remaining, 3);
  }

  // --- Mentor accept / complete does not deduct again ---
  resetStores();
  {
    const bounds = periodBounds();
    await activateSessionPeriodFromPayment({
      studentUserId: studentPro,
      planId: "pro",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      stripeInvoiceId: "in_pro_accept"
    });
    const meeting = await book(studentPro, "pro", 1, `pro-accept-${Date.now()}`);
    assert.equal((await getSessionCreditSummary(studentPro)).remaining, 3);
    await updateScheduledMeeting(
      meeting.id,
      { status: "approved", zoomJoinUrl: "https://zoom.us/j/1234567890" },
      { id: mentorId, role: "MENTOR" }
    );
    assert.equal((await getSessionCreditSummary(studentPro)).remaining, 3);
  }

  // --- PAYMENT RESET ---
  resetStores();
  {
    const first = periodBounds(14);
    await activateSessionPeriodFromPayment({
      studentUserId: studentPro,
      planId: "pro",
      periodStart: first.start,
      periodEnd: first.end,
      stripeInvoiceId: "in_pro_period1"
    });
    await book(studentPro, "pro", 1, `pro-roll-1-${Date.now()}`);
    ageMeetingRequests();
    await book(studentPro, "pro", 2, `pro-roll-2-${Date.now()}`);
    assert.equal((await getSessionCreditSummary(studentPro)).remaining, 2);

    const secondStart = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const secondEnd = new Date(secondStart.getTime() + 28 * 24 * 60 * 60 * 1000);
    await grantSessionCreditsFromPaidInvoice({
      studentUserId: studentPro,
      planId: "pro",
      invoice: {
        id: "in_pro_period2",
        status: "paid",
        amount_paid: 9900,
        billing_reason: "subscription_cycle",
        lines: {
          data: [
            {
              period: {
                start: Math.floor(secondStart.getTime() / 1000),
                end: Math.floor(secondEnd.getTime() / 1000)
              }
            }
          ]
        }
      },
      subscription: { id: "sub_pro", current_period_start: Math.floor(secondStart.getTime() / 1000), current_period_end: Math.floor(secondEnd.getTime() / 1000) }
    });
    let summary = await getSessionCreditSummary(studentPro);
    assert.equal(summary.remaining, 4, "unused credits must not roll over");
    assert.equal(summary.allowance, 4);

    // Duplicate paid invoice webhook
    await grantSessionCreditsFromPaidInvoice({
      studentUserId: studentPro,
      planId: "pro",
      invoice: {
        id: "in_pro_period2",
        status: "paid",
        amount_paid: 9900,
        billing_reason: "subscription_cycle",
        lines: {
          data: [
            {
              period: {
                start: Math.floor(secondStart.getTime() / 1000),
                end: Math.floor(secondEnd.getTime() / 1000)
              }
            }
          ]
        }
      },
      subscription: { id: "sub_pro" }
    });
    summary = await getSessionCreditSummary(studentPro);
    assert.equal(summary.remaining, 4, "duplicate webhook must not reset twice");
  }

  // Plus renewal resets to exactly 2
  resetStores();
  {
    const first = periodBounds(10);
    await activateSessionPeriodFromPayment({
      studentUserId: studentPlus,
      planId: "plus",
      periodStart: first.start,
      periodEnd: first.end,
      stripeInvoiceId: "in_plus_1"
    });
    await book(studentPlus, "plus", 1, `plus-roll-${Date.now()}`);
    assert.equal((await getSessionCreditSummary(studentPlus)).remaining, 1);

    const secondStart = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000);
    const secondEnd = new Date(secondStart.getTime() + 28 * 24 * 60 * 60 * 1000);
    await grantSessionCreditsFromPaidInvoice({
      studentUserId: studentPlus,
      planId: "plus",
      invoice: {
        id: "in_plus_2",
        status: "paid",
        amount_paid: 4900,
        billing_reason: "subscription_cycle",
        lines: {
          data: [
            {
              period: {
                start: Math.floor(secondStart.getTime() / 1000),
                end: Math.floor(secondEnd.getTime() / 1000)
              }
            }
          ]
        }
      },
      subscription: { id: "sub_plus" }
    });
    assert.equal((await getSessionCreditSummary(studentPlus)).remaining, 2);
  }

  // Failed payment does not reset
  resetStores();
  {
    const bounds = periodBounds();
    await activateSessionPeriodFromPayment({
      studentUserId: studentPro,
      planId: "pro",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      stripeInvoiceId: "in_pro_fail_base"
    });
    await book(studentPro, "pro", 1, `pro-fail-${Date.now()}`);
    const before = await getSessionCreditSummary(studentPro);
    await grantSessionCreditsFromPaidInvoice({
      studentUserId: studentPro,
      planId: "pro",
      invoice: {
        id: "in_pro_failed",
        status: "open",
        amount_paid: 0,
        billing_reason: "subscription_cycle"
      },
      subscription: { id: "sub_pro" }
    });
    assert.equal((await getSessionCreditSummary(studentPro)).remaining, before.remaining);
  }

  // Passing four weeks without payment does not create credits
  resetStores();
  {
    const pastStart = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString();
    await activateSessionPeriodFromPayment({
      studentUserId: studentPro,
      planId: "pro",
      periodStart: pastStart,
      periodEnd: pastEnd,
      stripeInvoiceId: "in_pro_old"
    });
    await expireSessionPeriodsAtPeriodEnd(studentPro);
    const summary = await getSessionCreditSummary(studentPro);
    assert.equal(summary.active, false);
    assert.equal(summary.remaining, 0);
  }

  // --- CANCELLATION: credits usable until period end ---
  resetStores();
  {
    const bounds = periodBounds(20);
    await activateSessionPeriodFromPayment({
      studentUserId: studentPlus,
      planId: "plus",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      stripeInvoiceId: "in_plus_cancel"
    });
    const access = evaluateMentorAccess({
      user: {
        ...userFor(studentPlus, "plus"),
        subscriptionStatus: "active"
      },
      sessionCredits: await getSessionCreditSummary(studentPlus)
    });
    assert.equal(access.allowed, true);
    assert.equal(access.subscriptionRemaining, 2);

    await book(studentPlus, "plus", 1, `plus-cancel-book-${Date.now()}`);
    assert.equal((await getSessionCreditSummary(studentPlus)).remaining, 1);

    // At period end, unused credits expire and booking is disabled.
    await expireSessionPeriodsAtPeriodEnd(studentPlus, {
      now: new Date(new Date(bounds.end).getTime() + 1000)
    });
    const afterEnd = await getSessionCreditSummary(studentPlus);
    assert.equal(afterEnd.active, false);
    assert.equal(afterEnd.remaining, 0);
    const blocked = evaluateMentorAccess({
      user: { ...userFor(studentPlus, "plus"), subscriptionStatus: "canceled" },
      sessionCredits: afterEnd
    });
    assert.equal(blocked.allowed, false);
  }

  console.log("sessionCredits.node.test.js: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
