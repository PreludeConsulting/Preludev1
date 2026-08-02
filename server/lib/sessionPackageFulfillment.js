/**
 * Fulfill purchased session / essay-review inventory from a Stripe Checkout Session.
 * Idempotent on stripe checkout session id.
 */

import {
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful,
  resolvePurchaseFromPaymentLinkId,
  stripePaymentLinkObjectId
} from "../../shared/stripePaymentLinks.js";

function parseBundleConfigQuantity(metadata = {}, quantityKeys = []) {
  if (!metadata.bundleConfig) return null;
  try {
    const config = JSON.parse(metadata.bundleConfig);
    const quantities = config?.q || config?.quantities || {};
    for (const key of quantityKeys) {
      if (quantities?.[key] != null) return quantities[key];
    }
  } catch {
    return null;
  }
  return null;
}

function parsePositiveInt(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractPaidCheckoutCredit(session, { bundleId, quantityKeys, metadataFallbackKeys = [] }) {
  if (!session) return null;
  if (!isCheckoutPaymentSuccessful(session)) {
    // Legacy fixtures: mode payment + status complete without payment_status.
    if (!(session.mode === "payment" && session.status === "complete" && !session.payment_status)) {
      return null;
    }
  }

  const metadata = session.metadata || {};
  if (String(metadata.bundleId || "").trim() !== bundleId) return null;

  const studentUserId = metadata.userId || session.client_reference_id || null;
  if (!studentUserId) return null;

  let qty = parseBundleConfigQuantity(metadata, quantityKeys);
  if (qty == null) {
    for (const key of metadataFallbackKeys) {
      if (metadata[key] != null) {
        qty = metadata[key];
        break;
      }
    }
  }
  const sessionsPurchased = parsePositiveInt(qty);
  if (!sessionsPurchased) return null;

  return {
    studentUserId: String(studentUserId),
    mentorUserId: metadata.mentorUserId || null,
    sessionsPurchased,
    stripeCheckoutSessionId: session.id || null,
    bundleId
  };
}

export function extractFlexibleSessionCredit(session) {
  return extractPaidCheckoutCredit(session, {
    bundleId: "flexible_sessions",
    quantityKeys: ["sessions"],
    metadataFallbackKeys: ["sessionsPurchased"]
  });
}

export function extractEssaySupportCredit(session) {
  const enriched = enrichCheckoutSessionFromPaymentLink(session);
  const paymentLinkId = stripePaymentLinkObjectId(session?.payment_link);
  const linkedPurchase = resolvePurchaseFromPaymentLinkId(paymentLinkId);

  // Unknown Payment Link IDs must never grant essay credits.
  if (paymentLinkId && !linkedPurchase) return null;
  if (linkedPurchase && linkedPurchase.kind !== "essay_support") return null;

  const credit = extractPaidCheckoutCredit(enriched, {
    bundleId: "essay_support",
    quantityKeys: ["essayReviews"],
    metadataFallbackKeys: ["essayReviews", "creditQuantity", "sessionsPurchased"]
  });
  if (!credit) return null;

  const metadata = enriched.metadata || {};
  const purchaseType = String(metadata.purchaseType || "").trim();
  if (purchaseType && purchaseType !== "ESSAY_SUPPORT" && purchaseType !== "one_time_bundle") {
    return null;
  }

  // Prefer verified Payment Link mapping over any client/metadata quantity.
  if (linkedPurchase?.kind === "essay_support") {
    credit.sessionsPurchased = linkedPurchase.credits;
    credit.packageKey = linkedPurchase.packageKey;
  } else {
    const fromCreditQuantity = parsePositiveInt(metadata.creditQuantity);
    if (fromCreditQuantity) credit.sessionsPurchased = fromCreditQuantity;
    credit.packageKey =
      String(metadata.packageKey || "").trim() || `essay_support_${credit.sessionsPurchased}`;
  }

  credit.studentUserId = String(metadata.studentId || credit.studentUserId);
  credit.purchaserUserId = metadata.purchaserUserId || metadata.userId || null;
  return credit;
}

export async function fulfillFlexibleSessionCheckout(session, creditFn) {
  const credit = extractFlexibleSessionCredit(session);
  if (!credit || typeof creditFn !== "function") return null;
  return creditFn(credit);
}

export async function fulfillEssaySupportCheckout(session, creditFn) {
  const credit = extractEssaySupportCredit(session);
  if (!credit || typeof creditFn !== "function") return null;
  return creditFn(credit);
}
