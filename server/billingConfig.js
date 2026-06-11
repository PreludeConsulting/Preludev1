export const BILLING_PROVIDER_DISABLED = "disabled";
export const BILLING_PROVIDER_STRIPE = "stripe";

export const PAID_PLAN_IDS = ["basic", "plus", "pro"];

const PRICE_ENV_BY_PLAN = {
  basic: "STRIPE_PRICE_ID_BASIC",
  plus: "STRIPE_PRICE_ID_PLUS",
  pro: "STRIPE_PRICE_ID_PRO"
};

export function getBillingConfig(env = process.env) {
  const provider = (env.BILLING_PROVIDER || BILLING_PROVIDER_DISABLED).toLowerCase();
  const stripeSecretKey = env.STRIPE_SECRET_KEY || "";
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET || "";
  const stripePublishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  // Prefer the STRIPE_PRICE_ID_* names used by Stripe Checkout setup.
  // The older *_MONTHLY aliases are still accepted so existing deployments do not break.
  const prices = {
    basic: env.STRIPE_PRICE_ID_BASIC || env.STRIPE_PRICE_BASIC_MONTHLY || "",
    plus: env.STRIPE_PRICE_ID_PLUS || env.STRIPE_PRICE_PLUS_MONTHLY || "",
    pro: env.STRIPE_PRICE_ID_PRO || env.STRIPE_PRICE_PRO_MONTHLY || ""
  };

  const missing = [];
  if (provider === BILLING_PROVIDER_STRIPE) {
    if (!stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
    for (const planId of PAID_PLAN_IDS) {
      if (!prices[planId]) missing.push(PRICE_ENV_BY_PLAN[planId]);
    }
  }

  return {
    provider,
    enabled: provider === BILLING_PROVIDER_STRIPE && missing.length === 0,
    webhookEnabled: provider === BILLING_PROVIDER_STRIPE && Boolean(stripeSecretKey) && Boolean(stripeWebhookSecret),
    missing,
    prices,
    stripePublishableKey,
    stripeSecretKey,
    stripeWebhookSecret
  };
}

export function getPlanPriceId(planId, config = getBillingConfig()) {
  if (!PAID_PLAN_IDS.includes(planId)) return null;
  return config.prices[planId] || null;
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

export function billingNotConfiguredPayload(config = getBillingConfig()) {
  return {
    error: "billing_not_configured",
    message: "Paid subscriptions are not connected yet. Please try again once billing is configured.",
    provider: config.provider,
    missing: config.provider === BILLING_PROVIDER_STRIPE ? config.missing : []
  };
}
