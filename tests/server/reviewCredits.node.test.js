import assert from "node:assert/strict";
import test from "node:test";
import {
  ESSAY_SUPPORT_ACTIVITY_TYPES,
  isEssaySupportOnlyStudent,
  summarizeReviewCredits
} from "../../server/lib/reviewCredits.js";
import {
  buildEssaySupportPackages,
  resolveEssaySupportCheckoutPackage
} from "../../shared/essaySupportPackages.js";
import { BUNDLE_QUANTITY_OPTIONS, ESSAY_SUPPORT_PRICE_CENTS } from "../../shared/supportBundles.js";

test("review credit summary stacks purchases and nets assignments", () => {
  const summary = summarizeReviewCredits(
    [
      { amount: 3, transactionType: "PURCHASE" },
      { amount: 5, transactionType: "PURCHASE" },
      { amount: -1, transactionType: "ACTIVITY_ASSIGNED" },
      { amount: -1, transactionType: "ACTIVITY_ASSIGNED" },
      { amount: 1, transactionType: "ACTIVITY_CANCELLED" }
    ],
    []
  );
  assert.equal(summary.purchased, 8);
  assert.equal(summary.assigned, 1);
  assert.equal(summary.remaining, 7);
});

test("review credit summary never goes negative", () => {
  const summary = summarizeReviewCredits(
    [
      { amount: 1, transactionType: "PURCHASE" },
      { amount: -1, transactionType: "ACTIVITY_ASSIGNED" },
      { amount: -1, transactionType: "ACTIVITY_ASSIGNED" }
    ],
    []
  );
  assert.equal(summary.remaining, 0);
});

test("essay support only plan gate", () => {
  assert.equal(isEssaySupportOnlyStudent({ plan: "basic" }), true);
  assert.equal(isEssaySupportOnlyStudent({ plan: "essay_support" }), true);
  assert.equal(isEssaySupportOnlyStudent({ plan: "plus", subscriptionStatus: "active" }), false);
  assert.equal(isEssaySupportOnlyStudent({ plan: "pro", subscriptionStatus: "" }), false);
  assert.equal(isEssaySupportOnlyStudent({ plan: "plus", subscriptionStatus: "canceled" }), true);
  assert.deepEqual(ESSAY_SUPPORT_ACTIVITY_TYPES, ["personal_statement", "supplemental_essay"]);
});

test("authoritative essay packages map all quantities", () => {
  const packages = buildEssaySupportPackages({
    STRIPE_PRICE_ID_ESSAY_SUPPORT_3: "price_essay3",
    STRIPE_PRICE_ID_ESSAY_SUPPORT_4: "price_essay4",
    STRIPE_PRICE_ID_ESSAY_SUPPORT_5: "price_essay5",
    STRIPE_PRICE_ID_ESSAY_SUPPORT_6: "price_essay6",
    STRIPE_PRICE_ID_ESSAY_SUPPORT_7: "price_essay7",
    STRIPE_PRICE_ID_ESSAY_SUPPORT_8: "price_essay8",
    STRIPE_PRICE_ID_ESSAY_SUPPORT_10: "price_essay10"
  });
  for (const qty of BUNDLE_QUANTITY_OPTIONS) {
    const pkg = packages[`essay_support_${qty}`];
    assert.equal(pkg.credits, qty);
    assert.equal(pkg.amountCents, ESSAY_SUPPORT_PRICE_CENTS[qty]);
    assert.equal(pkg.stripePriceId, `price_essay${qty}`);
  }
});

test("missing Stripe price fails safely", () => {
  const result = resolveEssaySupportCheckoutPackage(
    { packageKey: "essay_support_4" },
    { STRIPE_PRICE_ID_ESSAY_SUPPORT_3: "price_essay3" }
  );
  assert.equal(result.ok, false);
  assert.equal(result.message, "This Essay Support package is temporarily unavailable.");
});

test("unsupported package keys are rejected", () => {
  assert.equal(resolveEssaySupportCheckoutPackage({ packageKey: "essay_support_9" }, {}).ok, false);
  assert.equal(resolveEssaySupportCheckoutPackage({ credits: 9 }, {}).ok, false);
});
