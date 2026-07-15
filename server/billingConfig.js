import {
  BUNDLE_PRICE_ENV_BY_ID,
  PLAN_PRICE_ENV_BY_ID
} from "../shared/billingCatalog.js";

export const BILLING_PROVIDER_DISABLED = "disabled";
export const BILLING_PROVIDER_STRIPE = "stripe";
export const STRIPE_API_VERSION = "2026-05-27.dahlia";

export const PAID_PLAN_IDS = ["basic", "plus", "pro"];

const PLACEHOLDER_PRICE_ID = /placeholder|replace|change[-_]?me|example|todo|your[-_]?price|x{3,}/i;

export function isConfiguredStripePriceId(value) {
  const priceId = String(value || "").trim();
  return /^price_[A-Za-z0-9]+$/.test(priceId) && !PLACEHOLDER_PRICE_ID.test(priceId);
}

function readPlanPrices(env) {
  return {
    basic: env.STRIPE_PRICE_ID_BASIC || env.STRIPE_PRICE_BASIC_MONTHLY || "",
    plus: env.STRIPE_PRICE_ID_PLUS || env.STRIPE_PRICE_PLUS_MONTHLY || "",
    pro: env.STRIPE_PRICE_ID_PRO || env.STRIPE_PRICE_PRO_MONTHLY || ""
  };
}

function readBundlePrices(env) {
  return Object.fromEntries(
    Object.entries(BUNDLE_PRICE_ENV_BY_ID).map(([bundleId, quantityMap]) => [
      bundleId,
      Object.fromEntries(
        Object.entries(quantityMap).map(([quantity, envKey]) => [quantity, env[envKey] || ""])
      )
    ])
  );
}

export function getBillingConfig(env = process.env) {
  const provider = (env.BILLING_PROVIDER || BILLING_PROVIDER_DISABLED).toLowerCase();
  const stripeSecretKey = env.STRIPE_SECRET_KEY || "";
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET || "";
  const stripePublishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || "";
  // Prefer STRIPE_PRICE_ID_* names. Older plan-only aliases remain accepted so
  // an existing deployment can be updated without interrupting subscribers.
  const prices = readPlanPrices(env);
  const bundlePrices = readBundlePrices(env);

  const missing = [];
  if (provider === BILLING_PROVIDER_STRIPE) {
    if (!stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
    for (const planId of PAID_PLAN_IDS) {
      if (!isConfiguredStripePriceId(prices[planId])) missing.push(PLAN_PRICE_ENV_BY_ID[planId]);
    }
    for (const [bundleId, quantityMap] of Object.entries(BUNDLE_PRICE_ENV_BY_ID)) {
      for (const [quantity, envKey] of Object.entries(quantityMap)) {
        if (!isConfiguredStripePriceId(bundlePrices[bundleId][quantity])) missing.push(envKey);
      }
    }
  }

  return {
    provider,
    enabled: provider === BILLING_PROVIDER_STRIPE && missing.length === 0,
    webhookEnabled: provider === BILLING_PROVIDER_STRIPE && Boolean(stripeSecretKey) && Boolean(stripeWebhookSecret),
    missing,
    prices,
    bundlePrices,
    stripePublishableKey,
    stripeSecretKey,
    stripeWebhookSecret,
    referralCouponId: env.STRIPE_REFERRAL_COUPON_ID || ""
  };
}

export function getPlanPriceId(planId, config = getBillingConfig()) {
  if (!PAID_PLAN_IDS.includes(planId)) return null;
  const priceId = config.prices[planId];
  return isConfiguredStripePriceId(priceId) ? priceId : null;
}

export function getBundlePriceId(bundleId, quantity, config = getBillingConfig()) {
  const priceId = config.bundlePrices?.[bundleId]?.[quantity];
  return isConfiguredStripePriceId(priceId) ? priceId : null;
}

export function getPlanIdForPriceId(priceId, config = getBillingConfig()) {
  return PAID_PLAN_IDS.find((planId) => getPlanPriceId(planId, config) === priceId) || null;
}

export function getRequestOrigin(req) {
  const forwardedProto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  return `${protocol}://${host}`;
}

export function getAppBaseUrl(req) {
  return (process.env.PUBLIC_APP_URL || getRequestOrigin(req)).replace(/\/$/, "");
}

export function isGuestCheckoutAllowed(req, env = process.env) {
  if (env.STRIPE_ALLOW_GUEST_CHECKOUT === "true") return true;
  if (env.NODE_ENV === "production") return false;
  const host = req.headers.host || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

export function billingNotConfiguredPayload(config = getBillingConfig()) {
  return {
    error: "billing_not_configured",
    message: "Paid subscriptions are not connected yet. Please try again once billing is configured.",
    provider: config.provider,
    missing: config.provider === BILLING_PROVIDER_STRIPE ? config.missing : []
  };
}
