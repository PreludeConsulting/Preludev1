/**
 * Household / referral lifecycle rules with an in-memory fake store.
 * Covers shared-code, mentor exclusion, idempotent confirm, single claim, queueing, revoke.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  canClaimForNextInvoice,
  generateReferralCodeCandidate,
  isReferralEligibleRole,
  normalizeReferralCodeInput
} from "../server/lib/referralCodes.js";

function createFakeHouseholdStore() {
  const households = new Map();
  const members = new Map(); // userId -> householdId
  const codes = new Map(); // householdId -> code
  const referrals = [];
  const rewards = [];
  const notifications = [];

  function ensureHousehold(userId, role, linkedUserIds = []) {
    if (!isReferralEligibleRole(role)) return null;
    if (members.has(userId)) return members.get(userId);
    for (const linked of linkedUserIds) {
      if (members.has(linked)) {
        const hh = members.get(linked);
        members.set(userId, hh);
        households.get(hh).members.add(userId);
        return hh;
      }
    }
    const hh = `hh_${households.size + 1}`;
    households.set(hh, { id: hh, members: new Set([userId]) });
    members.set(userId, hh);
    for (const linked of linkedUserIds) {
      if (isReferralEligibleRole("student") || isReferralEligibleRole("parent")) {
        members.set(linked, hh);
        households.get(hh).members.add(linked);
      }
    }
    return hh;
  }

  function ensureCode(householdId, seedName) {
    if (codes.has(householdId)) return codes.get(householdId);
    const code = generateReferralCodeCandidate(seedName);
    codes.set(householdId, normalizeReferralCodeInput(code));
    return codes.get(householdId);
  }

  function confirmPayment(referralId, paymentId) {
    const existing = referrals.find((r) => r.qualifyingPaymentId === paymentId);
    if (existing) return { referral: existing, duplicate: true };
    const referral = referrals.find((r) => r.id === referralId);
    if (!referral || referral.status === "confirmed") {
      return { referral, duplicate: Boolean(referral?.status === "confirmed") };
    }
    referral.status = "confirmed";
    referral.qualifyingPaymentId = paymentId;
    const reward = {
      id: `rw_${rewards.length + 1}`,
      referralId,
      householdId: referral.referrerHouseholdId,
      status: "available"
    };
    rewards.push(reward);
    for (const userId of households.get(referral.referrerHouseholdId).members) {
      notifications.push({ userId, rewardId: reward.id, title: "Your referral reward is ready" });
    }
    return { referral, reward, duplicate: false };
  }

  function claimReward(rewardId, periodEnd) {
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward || reward.status !== "available") return { ok: false, error: "unavailable" };
    if (rewards.some((r) => r.householdId === reward.householdId && ["claimed", "scheduled"].includes(r.status))) {
      return { ok: false, error: "queued" };
    }
    const cutoff = canClaimForNextInvoice(periodEnd);
    if (!cutoff.ok) return { ok: false, error: cutoff.reason, remainsAvailable: true };
    reward.status = "scheduled";
    return { ok: true, reward };
  }

  function revokeByPayment(paymentId) {
    const referral = referrals.find((r) => r.qualifyingPaymentId === paymentId);
    if (!referral) return 0;
    let count = 0;
    for (const reward of rewards.filter((r) => r.referralId === referral.id)) {
      if (["available", "claimed", "scheduled"].includes(reward.status)) {
        reward.status = "revoked";
        count += 1;
      }
    }
    return count;
  }

  return {
    ensureHousehold,
    ensureCode,
    referrals,
    rewards,
    notifications,
    members,
    codes,
    addReferral(row) {
      referrals.push(row);
      return row;
    },
    confirmPayment,
    claimReward,
    revokeByPayment
  };
}

describe("referral household lifecycle (fake store)", () => {
  it("1+12: linked student and parent share one referral code and see the same reward", () => {
    const store = createFakeHouseholdStore();
    const studentHh = store.ensureHousehold("student-1", "student");
    const parentHh = store.ensureHousehold("parent-1", "parent", ["student-1"]);
    assert.equal(studentHh, parentHh);
    const codeA = store.ensureCode(studentHh, "Peter");
    const codeB = store.ensureCode(parentHh, "Parent");
    assert.equal(codeA, codeB);

    store.addReferral({
      id: "ref-1",
      referrerHouseholdId: studentHh,
      status: "pending_payment"
    });
    const { reward } = store.confirmPayment("ref-1", "pay_1");
    const houseNotifications = store.notifications.filter((n) => n.rewardId === reward.id);
    assert.equal(houseNotifications.length, 2);
  });

  it("2+22: mentors do not get households or redeem codes", () => {
    const store = createFakeHouseholdStore();
    assert.equal(store.ensureHousehold("mentor-1", "mentor"), null);
    assert.equal(isReferralEligibleRole("mentor"), false);
  });

  it("8+9+10: referral stays pending until payment; webhook retries are idempotent", () => {
    const store = createFakeHouseholdStore();
    const hh = store.ensureHousehold("student-1", "student");
    store.addReferral({ id: "ref-1", referrerHouseholdId: hh, status: "pending_payment" });
    const first = store.confirmPayment("ref-1", "pay_1");
    const second = store.confirmPayment("ref-1", "pay_1");
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(store.rewards.length, 1);
  });

  it("13+14: reward can be claimed only once (second claim fails)", () => {
    const store = createFakeHouseholdStore();
    const hh = store.ensureHousehold("student-1", "student");
    store.addReferral({ id: "ref-1", referrerHouseholdId: hh, status: "pending_payment" });
    const { reward } = store.confirmPayment("ref-1", "pay_1");
    const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const first = store.claimReward(reward.id, periodEnd);
    const second = store.claimReward(reward.id, periodEnd);
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
  });

  it("15+16: seven-day cutoff blocks imminent invoice but keeps reward available", () => {
    const store = createFakeHouseholdStore();
    const hh = store.ensureHousehold("student-1", "student");
    store.addReferral({ id: "ref-1", referrerHouseholdId: hh, status: "pending_payment" });
    const { reward } = store.confirmPayment("ref-1", "pay_1");
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const blocked = store.claimReward(reward.id, soon);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error, "claim_cutoff");
    assert.equal(blocked.remainsAvailable, true);
    assert.equal(reward.status, "available");
  });

  it("17: multiple rewards queue — only one inflight per household", () => {
    const store = createFakeHouseholdStore();
    const hh = store.ensureHousehold("student-1", "student");
    store.addReferral({ id: "ref-1", referrerHouseholdId: hh, status: "pending_payment" });
    store.addReferral({ id: "ref-2", referrerHouseholdId: hh, status: "pending_payment" });
    const r1 = store.confirmPayment("ref-1", "pay_1").reward;
    const r2 = store.confirmPayment("ref-2", "pay_2").reward;
    const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    assert.equal(store.claimReward(r1.id, periodEnd).ok, true);
    assert.equal(store.claimReward(r2.id, periodEnd).error, "queued");
    assert.equal(r2.status, "available");
  });

  it("19: refunded qualifying payment revokes unused reward", () => {
    const store = createFakeHouseholdStore();
    const hh = store.ensureHousehold("student-1", "student");
    store.addReferral({ id: "ref-1", referrerHouseholdId: hh, status: "pending_payment" });
    store.confirmPayment("ref-1", "pay_1");
    assert.equal(store.revokeByPayment("pay_1"), 1);
    assert.equal(store.rewards[0].status, "revoked");
  });

  it("20+21+24: backfill is idempotent and normalization is stable", () => {
    const store = createFakeHouseholdStore();
    const hh = store.ensureHousehold("student-1", "student");
    const first = store.ensureCode(hh, "Peter");
    const second = store.ensureCode(hh, "Peter");
    assert.equal(first, second);
    assert.equal(normalizeReferralCodeInput(" peter-k7q4 "), "PETER-K7Q4");
  });

  it("6+7: self / same household codes resolve to identical household ids", () => {
    const store = createFakeHouseholdStore();
    const studentHh = store.ensureHousehold("s1", "student");
    const parentHh = store.ensureHousehold("p1", "parent", ["s1"]);
    assert.equal(studentHh, parentHh);
  });
});
