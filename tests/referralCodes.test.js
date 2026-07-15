import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  REFERRAL_CODE_PATTERN,
  REFERRAL_DISCOUNT_PERCENT,
  isReferralEligibleRole,
  normalizeReferralCodeInput,
  publicReferralError
} from "../shared/referralConstants.js";
import {
  canClaimForNextInvoice,
  generateReferralCodeCandidate,
  isValidReferralCodeFormat,
  isWithinClaimCutoff,
  nameSlugFromProfile,
  normalizeAndValidateFormat
} from "../server/lib/referralCodes.js";
import { invoiceHasReferralDiscount, invoiceIsQualifyingFirstPayment } from "../server/lib/referralStripe.js";

describe("referral code normalization and format", () => {
  it("normalizes codes case-insensitively and trims whitespace", () => {
    assert.equal(normalizeReferralCodeInput("  peter-k7q4 "), "PETER-K7Q4");
    assert.equal(normalizeAndValidateFormat("  PeTeR-K7Q4 ").normalized, "PETER-K7Q4");
  });

  it("accepts user-friendly slug-suffix codes", () => {
    assert.equal(isValidReferralCodeFormat("PETER-K7Q4"), true);
    assert.equal(REFERRAL_CODE_PATTERN.test("PETER-K7Q4"), true);
    assert.equal(isValidReferralCodeFormat("bad code!"), false);
    assert.equal(normalizeAndValidateFormat("!!!").ok, false);
  });

  it("builds non-sequential sounding candidates from names", () => {
    const a = generateReferralCodeCandidate("Peter Pan");
    const b = generateReferralCodeCandidate("Peter Pan");
    assert.match(a, /^PETER-[A-Z0-9]{4}$/);
    assert.match(b, /^PETER-[A-Z0-9]{4}$/);
    // Random suffix should usually differ; allow rare collision by regenerating
    const c = generateReferralCodeCandidate("Ada");
    assert.match(c, /^ADA-[A-Z0-9]{4}$/);
    assert.equal(nameSlugFromProfile("Ada Lovelace", "Addy"), "ADDY");
  });
});

describe("referral eligibility helpers", () => {
  it("allows only student and parent roles", () => {
    assert.equal(isReferralEligibleRole("student"), true);
    assert.equal(isReferralEligibleRole("PARENT"), true);
    assert.equal(isReferralEligibleRole("mentor"), false);
    assert.equal(isReferralEligibleRole("admin"), false);
  });

  it("maps errors to user-safe messages without leaking owner identity", () => {
    assert.match(publicReferralError("not_found"), /recognize/i);
    assert.match(publicReferralError("self_referral"), /own/i);
    assert.match(publicReferralError("mentor_ineligible"), /Student and Parent/i);
    assert.doesNotMatch(publicReferralError("not_found"), /@/);
  });

  it("keeps discount at 20 percent", () => {
    assert.equal(REFERRAL_DISCOUNT_PERCENT, 20);
  });
});

describe("referral reward claim cutoff", () => {
  it("allows claims at least 7 days before period end", () => {
    const far = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    assert.equal(canClaimForNextInvoice(far).ok, true);
    assert.equal(isWithinClaimCutoff(far), false);
  });

  it("blocks imminent invoice when fewer than 7 days remain but keeps reward available", () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const result = canClaimForNextInvoice(soon);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "claim_cutoff");
    assert.equal(isWithinClaimCutoff(soon), true);
  });
});

describe("stripe referral invoice helpers", () => {
  it("treats subscription_create paid invoices as qualifying", () => {
    assert.equal(
      invoiceIsQualifyingFirstPayment({
        paid: true,
        amount_paid: 2000,
        billing_reason: "subscription_create",
        subscription: "sub_123"
      }),
      true
    );
  });

  it("detects referral discount on invoice", () => {
    assert.equal(
      invoiceHasReferralDiscount({
        discount: { coupon: { id: "prelude_referral_20_once", percent_off: 20 } }
      }),
      true
    );
    assert.equal(invoiceHasReferralDiscount({ discount: null }), false);
  });
});

describe("referral business rules (pure)", () => {
  it("rejects mentor participation in message surface", () => {
    assert.match(publicReferralError("mentor_ineligible"), /only available/i);
    assert.match(publicReferralError("role_ineligible"), /account type/i);
  });

  it("rejects self and same-household referrals via dedicated errors", () => {
    assert.match(publicReferralError("self_referral"), /cannot use/i);
    assert.match(publicReferralError("same_household"), /own household/i);
    assert.match(publicReferralError("already_referred"), /already used/i);
    assert.match(publicReferralError("household_already_referred"), /already received/i);
  });

  it("surfaces claim race and ineligible subscription clearly", () => {
    assert.match(publicReferralError("claim_race"), /another household/i);
    assert.match(publicReferralError("subscription_ineligible"), /active monthly/i);
    assert.match(publicReferralError("reward_already_claimed"), /already been claimed/i);
  });
});
