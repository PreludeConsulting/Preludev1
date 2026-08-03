/**
 * Central Stripe Payment Link catalog for onboarding checkout.
 * Public buy.stripe.com URLs — keep IDs/URLs here (do not scatter in UI).
 */

/** @type {readonly [3, 4, 5, 6, 7, 8, 10]} */
export const ALLOWED_REVIEW_CREDITS = Object.freeze([3, 4, 5, 6, 7, 8, 10]);

export const ESSAY_SUPPORT_OPTIONS = Object.freeze({
  3: {
    price: 149,
    paymentLinkId: "plink_1U07jWGRpwYd0PZQ0ZcxaoMJ",
    url: "https://buy.stripe.com/00w5kD1Oi8QYb3dawS9Zm02"
  },
  4: {
    price: 189,
    paymentLinkId: "plink_1U07jxGRpwYd0PZQeQmfDlZJ",
    url: "https://buy.stripe.com/aFa3cvakOd7e5IT8oK9Zm05"
  },
  5: {
    price: 229,
    paymentLinkId: "plink_1U07jnGRpwYd0PZQV2FfqKht",
    url: "https://buy.stripe.com/3cI3cv50uc3a3AL8oK9Zm04"
  },
  6: {
    price: 265,
    paymentLinkId: "plink_1U07jfGRpwYd0PZQEDH0Fg21",
    url: "https://buy.stripe.com/8x2cN5csW5EM9Z934q9Zm03"
  },
  7: {
    price: 299,
    paymentLinkId: "plink_1U07k5GRpwYd0PZQXZaFZK9I",
    url: "https://buy.stripe.com/eVq8wP64yebi3ALcF09Zm06"
  },
  8: {
    price: 329,
    paymentLinkId: "plink_1U07kHGRpwYd0PZQCGaJXVyJ",
    url: "https://buy.stripe.com/4gMaEX3Wq8QY6MX8oK9Zm08"
  },
  10: {
    price: 399,
    paymentLinkId: "plink_1U07kCGRpwYd0PZQhKObWibu",
    url: "https://buy.stripe.com/aFa14neB4aZ62wHcF09Zm07"
  }
});

export const SUBSCRIPTION_PAYMENT_LINKS = Object.freeze({
  plus: {
    price: 149.99,
    paymentLinkId: "plink_1U07ivGRpwYd0PZQFhZs1ERC",
    url: "https://buy.stripe.com/cNi28r78C8QY2wHawS9Zm01"
  },
  pro: {
    price: 249.99,
    paymentLinkId: "plink_1U07i3GRpwYd0PZQn4S9M98R",
    url: "https://buy.stripe.com/9B69AT0Kec3a6MX5cy9Zm00"
  }
});

/** Stripe-hosted Customer Portal login (manage payment method, cancel, invoices). */
export const STRIPE_CUSTOMER_PORTAL_URL =
  "https://billing.stripe.com/p/login/9B69AT0Kec3a6MX5cy9Zm00";

export const STUDENT_BILLING_PATH = "/dashboard/student/billing";
export const STUDENT_BILLING_PLANS_PATH = "/dashboard/student/billing/plans";

export function buildStudentBillingPlansPath({ selection } = {}) {
  if (selection === "essay-support" || selection === "essay_support") {
    return `${STUDENT_BILLING_PLANS_PATH}?selection=essay-support&wallet=open&bundle=essay_support&details=open`;
  }
  return STUDENT_BILLING_PLANS_PATH;
}

export function openStripeCustomerPortal() {
  if (typeof globalThis === "undefined" || !globalThis.window) return;
  globalThis.window.location.assign(STRIPE_CUSTOMER_PORTAL_URL);
}
/** Price cents derived from ESSAY_SUPPORT_OPTIONS — single source of truth. */
export const ESSAY_SUPPORT_PRICE_CENTS_FROM_LINKS = Object.freeze(
  Object.fromEntries(
    Object.entries(ESSAY_SUPPORT_OPTIONS).map(([credits, option]) => [
      Number(credits),
      Math.round(Number(option.price) * 100)
    ])
  )
);

export function isAllowedReviewCreditQuantity(value) {
  const qty = Math.floor(Number(value));
  return ALLOWED_REVIEW_CREDITS.includes(qty);
}

export function getEssaySupportPaymentOption(credits) {
  const qty = Math.floor(Number(credits));
  if (!isAllowedReviewCreditQuantity(qty)) return null;
  return ESSAY_SUPPORT_OPTIONS[qty] || null;
}

export function getEssaySupportPaymentLink(credits) {
  return getEssaySupportPaymentOption(credits);
}

export function getSubscriptionPaymentLink(planId) {
  const id = String(planId || "")
    .trim()
    .toLowerCase();
  return SUBSCRIPTION_PAYMENT_LINKS[id] || null;
}

export function stripePaymentLinkObjectId(value) {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "object" && value.id) return String(value.id).trim() || null;
  return null;
}

/**
 * @returns {{ kind: "essay_support", credits: number, packageKey: string, price: number, paymentLinkId: string }
 *   | { kind: "subscription", planId: "plus" | "pro", paymentLinkId: string }
 *   | null}
 */
export function resolvePurchaseFromPaymentLinkId(paymentLinkId) {
  const id = stripePaymentLinkObjectId(paymentLinkId);
  if (!id) return null;

  for (const credits of ALLOWED_REVIEW_CREDITS) {
    const option = ESSAY_SUPPORT_OPTIONS[credits];
    if (option.paymentLinkId === id) {
      return {
        kind: "essay_support",
        credits,
        packageKey: `essay_support_${credits}`,
        price: option.price,
        paymentLinkId: id
      };
    }
  }

  for (const planId of /** @type {const} */ (["plus", "pro"])) {
    const option = SUBSCRIPTION_PAYMENT_LINKS[planId];
    if (option.paymentLinkId === id) {
      return { kind: "subscription", planId, paymentLinkId: id };
    }
  }

  return null;
}

/**
 * Build a Payment Link checkout URL with authenticated buyer identity.
 * @throws {Error} when userId or email is missing
 */
export function buildStripePaymentLinkUrl(baseUrl, { userId, email } = {}) {
  const id = String(userId || "").trim();
  const mail = String(email || "").trim();
  if (!id || !mail) {
    const error = new Error(
      "Your account is missing required checkout details. Please sign in again and retry."
    );
    error.code = "missing_checkout_identity";
    throw error;
  }

  const checkoutUrl = new URL(String(baseUrl));
  checkoutUrl.searchParams.set("client_reference_id", id);
  checkoutUrl.searchParams.set("locked_prefilled_email", mail);
  return checkoutUrl.toString();
}

/**
 * Enrich a Checkout Session created via Payment Link so fulfillment can use
 * verified Payment Link mapping instead of browser-supplied credit amounts.
 */
export function enrichCheckoutSessionFromPaymentLink(session) {
  if (!session || typeof session !== "object") return session;

  const paymentLinkId = stripePaymentLinkObjectId(session.payment_link);
  const purchase = resolvePurchaseFromPaymentLinkId(paymentLinkId);
  if (!purchase) return session;

  const metadata = { ...(session.metadata || {}) };
  const userId = String(metadata.userId || session.client_reference_id || "").trim();
  if (userId && !metadata.userId) metadata.userId = userId;

  if (purchase.kind === "essay_support") {
    // Always trust the verified Payment Link ID for credit quantity.
    metadata.bundleId = "essay_support";
    metadata.purchaseType = "ESSAY_SUPPORT";
    metadata.packageKey = purchase.packageKey;
    metadata.creditQuantity = String(purchase.credits);
    metadata.essayReviews = String(purchase.credits);
  } else if (purchase.kind === "subscription") {
    metadata.planId = purchase.planId;
  }

  return { ...session, metadata };
}

export function isCheckoutPaymentSuccessful(session) {
  if (!session) return false;
  const status = String(session.payment_status || "").toLowerCase();
  // Stripe marks fully discounted ($0) checkouts as paid.
  if (status === "paid" || status === "no_payment_required") return true;
  if (!status && session.status === "complete") return true;
  return false;
}
