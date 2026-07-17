/**
 * Monthly referral-code rotation rules (in-memory).
 * Complements referralLifecycle.test.js with rotation/attribution invariants.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  REFERRAL_BUSINESS_TIMEZONE,
  REFERRAL_CODE_PATTERN,
  formatReferralMonthLabel,
  normalizeReferralCodeInput,
  referralMonthParts,
  referralRotationIdempotencyKey
} from "../shared/referralConstants.js";
import {
  generateReferralCodeCandidate,
  isValidReferralCodeFormat
} from "../server/lib/referralCodes.js";
import {
  isFirstDayOfReferralMonth,
  resolveRotationMonth
} from "../server/lib/referralRotation.js";

function createRotatingCodeStore() {
  const households = new Map();
  const members = new Map();
  const codes = []; // { id, householdId, code, status, validMonth }
  const referrals = [];
  const rewards = [];
  const notifications = [];
  const rotationEvents = new Set();
  let seq = 0;

  function ensureHousehold(userId, role, linked = []) {
    if (role !== "student" && role !== "parent") return null;
    if (members.has(userId)) return members.get(userId);
    for (const linkedId of linked) {
      if (members.has(linkedId)) {
        const hh = members.get(linkedId);
        members.set(userId, hh);
        households.get(hh).add(userId);
        return hh;
      }
    }
    const hh = `hh_${++seq}`;
    households.set(hh, new Set([userId]));
    members.set(userId, hh);
    for (const linkedId of linked) {
      members.set(linkedId, hh);
      households.get(hh).add(linkedId);
    }
    return hh;
  }

  function ensureCode(householdId, validMonth, seed = "FRIEND") {
    const existingMonth = codes.find((c) => c.householdId === householdId && c.validMonth === validMonth);
    if (existingMonth) {
      if (existingMonth.status !== "active") {
        for (const c of codes.filter((row) => row.householdId === householdId && row.status === "active")) {
          c.status = "retired";
        }
        existingMonth.status = "active";
      }
      return existingMonth;
    }
    for (const c of codes.filter((row) => row.householdId === householdId && row.status === "active")) {
      c.status = "retired";
    }
    let candidate;
    let attempts = 0;
    do {
      candidate = normalizeReferralCodeInput(generateReferralCodeCandidate(seed));
      attempts += 1;
    } while (codes.some((c) => c.code === candidate) && attempts < 20);
    if (codes.some((c) => c.code === candidate)) {
      throw new Error("collision");
    }
    const row = {
      id: `code_${++seq}`,
      householdId,
      code: candidate,
      status: "active",
      validMonth
    };
    codes.push(row);
    return row;
  }

  function rotate(householdId, validMonth, { notify = true } = {}) {
    const before = codes.find((c) => c.householdId === householdId && c.status === "active");
    const already = codes.some((c) => c.householdId === householdId && c.validMonth === validMonth);
    const row = ensureCode(householdId, validMonth);
    let notificationsCreated = 0;
    const eventKey = `${householdId}:${validMonth}`;
    if (notify && !rotationEvents.has(eventKey) && (!already || before?.code !== row.code)) {
      rotationEvents.add(eventKey);
      for (const userId of households.get(householdId) || []) {
        const key = referralRotationIdempotencyKey(householdId, validMonth);
        if (notifications.some((n) => n.userId === userId && n.idempotencyKey === key)) continue;
        notifications.push({
          userId,
          householdId,
          validMonth,
          idempotencyKey: key,
          title: "Your referral code was updated"
        });
        notificationsCreated += 1;
      }
    }
    return {
      code: row.code,
      skipped: already && before?.code === row.code,
      notificationsCreated
    };
  }

  function submitReferral(code, referredHouseholdId, referredUserId) {
    const row = codes.find((c) => c.code === normalizeReferralCodeInput(code));
    if (!row || row.status !== "active") return { ok: false, error: "expired_or_missing" };
    if (row.householdId === referredHouseholdId) return { ok: false, error: "self_referral" };
    const referral = {
      id: `ref_${++seq}`,
      referralCodeId: row.id,
      referrerHouseholdId: row.householdId,
      referredHouseholdId,
      referredUserId,
      status: "pending_payment"
    };
    referrals.push(referral);
    return { ok: true, referral };
  }

  function confirm(referralId, paymentId) {
    const byPay = referrals.find((r) => r.qualifyingPaymentId === paymentId);
    if (byPay) return { duplicate: true, referral: byPay };
    const referral = referrals.find((r) => r.id === referralId);
    referral.status = "confirmed";
    referral.qualifyingPaymentId = paymentId;
    const reward = {
      id: `rw_${++seq}`,
      referralId,
      householdId: referral.referrerHouseholdId,
      status: "available"
    };
    rewards.push(reward);
    return { duplicate: false, referral, reward };
  }

  return {
    ensureHousehold,
    ensureCode,
    rotate,
    submitReferral,
    confirm,
    codes,
    referrals,
    rewards,
    notifications,
    members,
    activeCode(householdId) {
      return codes.find((c) => c.householdId === householdId && c.status === "active");
    }
  };
}

describe("referral month helpers", () => {
  it("uses America/New_York for business month boundaries", () => {
    assert.equal(REFERRAL_BUSINESS_TIMEZONE, "America/New_York");
    // 2026-08-01 00:30 ET is still August; UTC may still be July 31 evening.
    const lateJulyUtc = new Date("2026-08-01T04:30:00.000Z"); // 00:30 ET on Aug 1 (EDT)
    const parts = referralMonthParts(lateJulyUtc);
    assert.equal(parts.validMonth, "2026-08");
    assert.equal(parts.day, 1);
    assert.equal(isFirstDayOfReferralMonth(lateJulyUtc), true);
  });

  it("handles December → January year rollover", () => {
    const dec = referralMonthParts(new Date("2026-12-15T17:00:00.000Z"));
    assert.equal(dec.validMonth, "2026-12");
    const jan = referralMonthParts(new Date("2027-01-01T05:00:00.000Z")); // midnight ET Jan 1
    assert.equal(jan.validMonth, "2027-01");
    assert.equal(formatReferralMonthLabel("2027-01-01"), "January 2027");
  });

  it("resolves CLI/API month inputs to YYYY-MM-01", () => {
    assert.equal(resolveRotationMonth("2026-09"), "2026-09-01");
    assert.equal(resolveRotationMonth("2026-09-15"), "2026-09-01");
  });
});

describe("referral code uniqueness + entropy", () => {
  it("generates 6-char suffixes with enough entropy and accepts legacy 4-char codes", () => {
    const a = generateReferralCodeCandidate("Peter");
    assert.match(a, /^PETER-[A-Z0-9]{6}$/);
    assert.equal(isValidReferralCodeFormat(a), true);
    assert.equal(isValidReferralCodeFormat("PETER-K7Q4"), true);
    assert.equal(REFERRAL_CODE_PATTERN.test("PETER-K7Q4"), true);
  });

  it("retries until unique in a crowded namespace", () => {
    const store = createRotatingCodeStore();
    const hh = store.ensureHousehold("s1", "student");
    const seen = new Set();
    for (let i = 0; i < 40; i += 1) {
      const year = 2100 + Math.floor(i / 12);
      const month = String((i % 12) + 1).padStart(2, "0");
      const row = store.ensureCode(hh, `${year}-${month}`, "Peter");
      assert.equal(seen.has(row.code), false);
      seen.add(row.code);
    }
  });
});

describe("shared student/parent monthly codes", () => {
  it("linked student and parent share one rotating code", () => {
    const store = createRotatingCodeStore();
    const studentHh = store.ensureHousehold("student-1", "student");
    const parentHh = store.ensureHousehold("parent-1", "parent", ["student-1"]);
    assert.equal(studentHh, parentHh);
    const july = store.ensureCode(studentHh, "2026-07", "Alex");
    const fromParent = store.activeCode(parentHh);
    assert.equal(july.code, fromParent.code);
  });

  it("rotation is idempotent within the same month", () => {
    const store = createRotatingCodeStore();
    const hh = store.ensureHousehold("s1", "student");
    const first = store.rotate(hh, "2026-08");
    const second = store.rotate(hh, "2026-08");
    assert.equal(second.skipped, true);
    assert.equal(first.code, second.code);
    assert.equal(store.codes.filter((c) => c.householdId === hh && c.validMonth === "2026-08").length, 1);
    assert.equal(store.notifications.length, 1);
  });

  it("concurrent-style double rotation still yields one code and one notification set", () => {
    const store = createRotatingCodeStore();
    const hh = store.ensureHousehold("s1", "student");
    store.ensureHousehold("p1", "parent", ["s1"]);
    const a = store.rotate(hh, "2026-09");
    const b = store.rotate(hh, "2026-09");
    assert.equal(a.code, b.code);
    assert.equal(store.notifications.length, 2); // one per household member
    const keys = new Set(store.notifications.map((n) => n.idempotencyKey));
    assert.equal(keys.size, 1);
  });
});

describe("attribution across rotation", () => {
  it("keeps referrer_household_id stable after the visible code changes", () => {
    const store = createRotatingCodeStore();
    const referrer = store.ensureHousehold("ref-student", "student");
    store.ensureHousehold("ref-parent", "parent", ["ref-student"]);
    const july = store.ensureCode(referrer, "2026-07", "Sam");

    const referred = store.ensureHousehold("new-student", "student");
    const submitted = store.submitReferral(july.code, referred, "new-student");
    assert.equal(submitted.ok, true);

    const august = store.rotate(referrer, "2026-08");
    assert.notEqual(august.code, july.code);
    assert.equal(july.status, "retired");

    const confirmed = store.confirm(submitted.referral.id, "pay_1");
    assert.equal(confirmed.reward.householdId, referrer);
    assert.equal(submitted.referral.referrerHouseholdId, referrer);

    // Old code no longer accepted for NEW referrals
    const late = store.submitReferral(july.code, store.ensureHousehold("other", "student"), "other");
    assert.equal(late.ok, false);
    assert.equal(late.error, "expired_or_missing");

    // New month code still works
    const okNew = store.submitReferral(august.code, store.ensureHousehold("other2", "student"), "other2");
    assert.equal(okNew.ok, true);
    assert.equal(okNew.referral.referrerHouseholdId, referrer);
  });

  it("does not reassign historical rewards when codes rotate", () => {
    const store = createRotatingCodeStore();
    const hhA = store.ensureHousehold("a", "student");
    const hhB = store.ensureHousehold("b", "student");
    const codeA = store.ensureCode(hhA, "2026-07", "A");
    store.submitReferral(codeA.code, hhB, "b");
    store.confirm(store.referrals[0].id, "pay_a");
    store.rotate(hhA, "2026-08");
    store.rotate(hhB, "2026-08");
    assert.equal(store.rewards[0].householdId, hhA);
    assert.equal(store.rewards[0].householdId !== hhB, true);
  });
});
