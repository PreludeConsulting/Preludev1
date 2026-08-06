import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_REVIEW_CREDITS,
  ESSAY_SUPPORT_OPTIONS,
  SUBSCRIPTION_PAYMENT_LINKS,
  buildStripePaymentLinkUrl,
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful,
  resolvePurchaseFromPaymentLinkId
} from "../../shared/stripePaymentLinks.js";
import {
  extractEssaySupportCredit
} from "../../server/lib/sessionPackageFulfillment.js";

test("allowed review credits skip 9", () => {
  assert.deepEqual([...ALLOWED_REVIEW_CREDITS], [3, 4, 5, 6, 7, 8, 10]);
  assert.equal(ALLOWED_REVIEW_CREDITS.includes(9), false);
});

test("every essay Payment Link maps to the correct credit quantity", () => {
  for (const credits of ALLOWED_REVIEW_CREDITS) {
    const option = ESSAY_SUPPORT_OPTIONS[credits];
    const purchase = resolvePurchaseFromPaymentLinkId(option.paymentLinkId);
    assert.equal(purchase.kind, "essay_support");
    assert.equal(purchase.credits, credits);
    assert.equal(purchase.packageKey, `essay_support_${credits}`);
  }
});

test("Plus and Pro Payment Links map to subscription plans", () => {
  assert.deepEqual(resolvePurchaseFromPaymentLinkId(SUBSCRIPTION_PAYMENT_LINKS.plus.paymentLinkId), {
    kind: "subscription",
    planId: "plus",
    paymentLinkId: SUBSCRIPTION_PAYMENT_LINKS.plus.paymentLinkId
  });
  assert.deepEqual(resolvePurchaseFromPaymentLinkId(SUBSCRIPTION_PAYMENT_LINKS.pro.paymentLinkId), {
    kind: "subscription",
    planId: "pro",
    paymentLinkId: SUBSCRIPTION_PAYMENT_LINKS.pro.paymentLinkId
  });
});

test("unknown Payment Link IDs resolve to null", () => {
  assert.equal(resolvePurchaseFromPaymentLinkId("plink_unknown_xxx"), null);
  assert.equal(resolvePurchaseFromPaymentLinkId(""), null);
});

test("buildStripePaymentLinkUrl appends identity params", () => {
  const url = new URL(
    buildStripePaymentLinkUrl(ESSAY_SUPPORT_OPTIONS[3].url, {
      userId: "user-1",
      email: "a@example.com"
    })
  );
  assert.equal(url.searchParams.get("client_reference_id"), "user-1");
  assert.equal(url.searchParams.get("locked_prefilled_email"), "a@example.com");
});

test("buildStripePaymentLinkUrl rejects missing identity", () => {
  assert.throws(
    () => buildStripePaymentLinkUrl(ESSAY_SUPPORT_OPTIONS[3].url, { userId: "x" }),
    /missing required checkout details/i
  );
});

test("enrichCheckoutSessionFromPaymentLink trusts Payment Link credits over metadata", () => {
  const session = enrichCheckoutSessionFromPaymentLink({
    id: "cs_1",
    client_reference_id: "student-1",
    payment_link: ESSAY_SUPPORT_OPTIONS[8].paymentLinkId,
    payment_status: "paid",
    metadata: {
      bundleId: "essay_support",
      creditQuantity: "3",
      essayReviews: "3",
      packageKey: "essay_support_3"
    }
  });
  assert.equal(session.metadata.creditQuantity, "8");
  assert.equal(session.metadata.essayReviews, "8");
  assert.equal(session.metadata.packageKey, "essay_support_8");
  assert.equal(session.metadata.userId, "student-1");
});

test("essay Payment Link enrichment strips planId so Plus/Pro is not overwritten", () => {
  const session = enrichCheckoutSessionFromPaymentLink({
    id: "cs_essay_keep_pro",
    client_reference_id: "student-pro",
    payment_link: ESSAY_SUPPORT_OPTIONS[3].paymentLinkId,
    payment_status: "paid",
    metadata: {
      userId: "student-pro",
      planId: "basic",
      bundleId: "essay_support"
    }
  });
  assert.equal(session.metadata.bundleId, "essay_support");
  assert.equal(session.metadata.purchaseType, "ESSAY_SUPPORT");
  assert.equal(session.metadata.creditQuantity, "3");
  assert.equal(session.metadata.planId, undefined);
});

test("extractEssaySupportCredit grants mapped Payment Link quantity", () => {
  const credit = extractEssaySupportCredit({
    id: "cs_essay_10",
    client_reference_id: "student-10",
    payment_link: ESSAY_SUPPORT_OPTIONS[10].paymentLinkId,
    payment_status: "paid",
    metadata: {
      // Hostile / stale browser metadata must be ignored.
      creditQuantity: "3",
      essayReviews: "3"
    }
  });
  assert.equal(credit.sessionsPurchased, 10);
  assert.equal(credit.packageKey, "essay_support_10");
  assert.equal(credit.studentUserId, "student-10");
});

test("unknown Payment Link does not grant essay credits", () => {
  const credit = extractEssaySupportCredit({
    id: "cs_bad",
    client_reference_id: "student-1",
    payment_link: "plink_unknown_xxx",
    payment_status: "paid",
    metadata: {
      bundleId: "essay_support",
      creditQuantity: "5",
      purchaseType: "ESSAY_SUPPORT"
    }
  });
  assert.equal(credit, null);
});

test("fully discounted $0 checkout still counts as successful payment", () => {
  assert.equal(
    isCheckoutPaymentSuccessful({ payment_status: "paid", amount_total: 0 }),
    true
  );
  assert.equal(
    isCheckoutPaymentSuccessful({ payment_status: "no_payment_required", amount_total: 0 }),
    true
  );
  assert.equal(isCheckoutPaymentSuccessful({ payment_status: "unpaid" }), false);
});

test("enrich maps Plus Payment Link to planId", () => {
  const session = enrichCheckoutSessionFromPaymentLink({
    id: "cs_plus",
    client_reference_id: "student-plus",
    payment_link: SUBSCRIPTION_PAYMENT_LINKS.plus.paymentLinkId,
    payment_status: "paid",
    amount_total: 0,
    mode: "subscription",
    metadata: {}
  });
  assert.equal(session.metadata.planId, "plus");
  assert.equal(session.metadata.userId, "student-plus");
});
