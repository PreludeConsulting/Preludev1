import { REFERRAL_DISCOUNT_PERCENT, logReferralEvent } from "../../shared/referralConstants.js";
import { getBillingConfig } from "../billingConfig.js";

const COUPON_NAME = "prelude_referral_20_once";

/**
 * Resolve or create a Stripe coupon: 20% off, duration once.
 * Prefer STRIPE_REFERRAL_COUPON_ID when set in the environment.
 */
export async function getOrCreateReferralCoupon(stripe, env = process.env) {
  const configured = env.STRIPE_REFERRAL_COUPON_ID || getBillingConfig(env).referralCouponId;
  if (configured) {
    try {
      const coupon = await stripe.coupons.retrieve(configured);
      if (coupon && !coupon.deleted) return coupon.id;
    } catch {
      /* fall through to create/lookup */
    }
  }

  const listed = await stripe.coupons.list({ limit: 100 });
  const existing = (listed.data || []).find(
    (c) => c.name === COUPON_NAME || c.id === COUPON_NAME || c.metadata?.preludeReferral === "true"
  );
  if (existing) return existing.id;

  const created = await stripe.coupons.create({
    id: COUPON_NAME,
    percent_off: REFERRAL_DISCOUNT_PERCENT,
    duration: "once",
    name: "Prelude referral 20% (one month)",
    metadata: { preludeReferral: "true" }
  });
  logReferralEvent("stripe_referral_coupon_created", { couponId: created.id });
  return created.id;
}

export async function applyReferralCouponToCheckoutSessionParams(sessionParams, couponId) {
  return {
    ...sessionParams,
    discounts: [{ coupon: couponId }]
  };
}

/** Attach one-time coupon to an existing subscription for the next invoice. */
export async function scheduleReferralDiscountOnSubscription(stripe, subscriptionId, couponId, metadata = {}) {
  const current = await stripe.subscriptions.retrieve(subscriptionId);
  const updated = await stripe.subscriptions.update(subscriptionId, {
    discounts: [{ coupon: couponId }],
    metadata: {
      ...(current.metadata || {}),
      ...metadata,
      preludeReferralReward: "true"
    }
  });
  logReferralEvent("reward_scheduled", {
    subscriptionId,
    couponId,
    rewardId: metadata.referralRewardId || null
  });
  return updated;
}

export function invoiceIsQualifyingFirstPayment(invoice) {
  if (!invoice) return false;
  if (invoice.paid === false) return false;
  const amountPaid = Number(invoice.amount_paid || 0);
  if (amountPaid <= 0 && !invoice.discount) {
    // Allow $0 only when a discount fully covered a positive subtotal
    const subtotal = Number(invoice.subtotal || 0);
    if (subtotal <= 0) return false;
  }
  const reason = String(invoice.billing_reason || "");
  return (
    reason === "subscription_create" ||
    reason === "subscription_cycle" ||
    Boolean(invoice.subscription)
  );
}

export function invoiceHasReferralDiscount(invoice) {
  const discounts = invoice?.discounts || (invoice?.discount ? [invoice.discount] : []);
  return (discounts || []).some((d) => {
    const coupon = d?.coupon || d;
    return (
      coupon?.id === COUPON_NAME ||
      coupon?.name === COUPON_NAME ||
      coupon?.metadata?.preludeReferral === "true" ||
      Number(coupon?.percent_off) === REFERRAL_DISCOUNT_PERCENT
    );
  });
}
