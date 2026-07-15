import Stripe from "stripe";
import { z } from "zod";
import { db, readJsonBody, requireAuth, requireCsrf, sendJson } from "./authApi.js";
import {
  billingNotConfiguredPayload,
  getAppBaseUrl,
  getBillingConfig,
  getBundlePriceId,
  getPlanIdForPriceId,
  getPlanPriceId,
  isGuestCheckoutAllowed,
  PAID_PLAN_IDS,
  STRIPE_API_VERSION
} from "./billingConfig.js";
import { PLAN_PRICE_CENTS } from "../shared/billingCatalog.js";
import { requireSupabaseUser, getSupabaseAdmin } from "./lib/supabaseRequestAuth.js";
import {
  syncSupabaseCheckoutSession,
  syncSupabaseSubscription
} from "./lib/supabaseBillingSync.js";
import { quoteBundleSelection, serializeBundleMetadata } from "../shared/supportBundles.js";
import {
  confirmReferralFromPayment,
  getPendingReferralForUser,
  markRewardApplied,
  markRewardAppliedBySubscription,
  revokeRewardsForQualifyingPayment
} from "./lib/referralCodes.js";
import {
  getOrCreateReferralCoupon,
  invoiceHasReferralDiscount,
  invoiceIsQualifyingFirstPayment
} from "./lib/referralStripe.js";

const checkoutSchema = z.object({
  planId: z.enum(["basic", "plus", "pro"]),
  guestCheckout: z.boolean().optional(),
  context: z.enum(["onboarding", "public"]).optional()
});

const bundleCheckoutSchema = z.object({
  bundleId: z.enum([
    "essay_support",
    "flexible_sessions",
    // Legacy IDs still accepted and remapped by quoteBundleSelection.
    "application_support",
    "college_application"
  ]),
  quantities: z.record(z.number()).optional(),
  addOns: z.record(z.boolean()).optional(),
  services: z.record(z.boolean()).optional(),
  sessionUses: z.record(z.boolean()).optional(),
  guestCheckout: z.boolean().optional(),
  context: z.enum(["onboarding", "public"]).optional()
});

const confirmSessionSchema = z.object({
  sessionId: z.string().trim().min(1)
});

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function getStripeClient(config = getBillingConfig()) {
  if (!config.stripeSecretKey) return null;
  return new Stripe(config.stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "Prelude", version: "1.0.0" },
    maxNetworkRetries: 2
  });
}

function stripeObjectId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

function checkoutPriceError(label) {
  const error = new Error(`Checkout for ${label} is unavailable because its Stripe Price does not match the published catalog.`);
  error.statusCode = 503;
  error.code = "billing_price_mismatch";
  return error;
}

async function requireMatchingStripePrice(stripe, { priceId, expectedCents, recurring, offeringId, label }) {
  let price;
  try {
    price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  } catch {
    throw checkoutPriceError(label);
  }

  const cadenceMatches = recurring
    ? price.type === "recurring" && price.recurring?.interval === "month" && price.recurring?.interval_count === 1
    : price.type === "one_time" && !price.recurring;
  const productOfferingId = typeof price.product === "object"
    ? price.product.metadata?.preludeOfferingId || price.product.metadata?.preludePlanId
    : null;
  if (
    !price.active ||
    price.currency?.toLowerCase() !== "usd" ||
    price.unit_amount !== expectedCents ||
    !cadenceMatches ||
    productOfferingId !== offeringId
  ) {
    throw checkoutPriceError(label);
  }
  return price;
}

function isBillingPath(pathname) {
  return (
    pathname === "/api/billing/config" ||
    pathname === "/api/billing/checkout" ||
    pathname === "/api/billing/bundle-checkout" ||
    pathname === "/api/billing/confirm-session" ||
    pathname === "/api/billing/portal" ||
    pathname === "/api/billing/webhook"
  );
}

function checkoutResultUrls(appBaseUrl, planId, context) {
  const contextQuery = context === "onboarding" ? "&context=onboarding" : "";
  return {
    successUrl: `${appBaseUrl}/checkout/success?plan=${planId}${contextQuery}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appBaseUrl}/checkout/cancel?plan=${planId}${contextQuery}`
  };
}

async function resolveCheckoutAuth(req, payload) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    try {
      const { user } = await requireSupabaseUser(req);
      return {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email
      };
    } catch (error) {
      if (payload.context === "onboarding") throw error;
    }
  }

  const guestCheckout = Boolean(payload.guestCheckout) && isGuestCheckoutAllowed(req);
  if (guestCheckout) return null;

  const auth = await requireAuth(req);
  requireCsrf(req);
  return {
    userId: auth.user.id,
    email: auth.user.email,
    name: `${auth.user.firstName || ""} ${auth.user.lastName || ""}`.trim() || auth.user.email,
    prismaUser: auth.user
  };
}

async function ensureStripeCustomerForCheckout(authUser, config) {
  if (authUser.prismaUser) {
    if (authUser.prismaUser.stripeCustomerId) return authUser.prismaUser.stripeCustomerId;
    const stripe = getStripeClient(config);
    const customer = await stripe.customers.create({
      email: authUser.email,
      name: authUser.name,
      metadata: { userId: authUser.userId }
    });
    await db().user.update({
      where: { id: authUser.userId },
      data: { stripeCustomerId: customer.id }
    });
    return customer.id;
  }

  const stripe = getStripeClient(config);
  const customer = await stripe.customers.create({
    email: authUser.email,
    name: authUser.name,
    metadata: { userId: authUser.userId }
  });
  return customer.id;
}

async function handleConfig(_req, res) {
  const config = getBillingConfig();
  sendJson(res, 200, {
    provider: config.provider,
    enabled: config.enabled,
    webhookEnabled: config.webhookEnabled,
    publishableKey: config.stripePublishableKey,
    paidPlans: PAID_PLAN_IDS
  });
}

async function handleCheckout(req, res) {
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  const payload = checkoutSchema.parse(await readJsonBody(req));
  if (payload.context === "onboarding" && !req.headers.authorization) {
    return sendJson(res, 401, { error: "unauthenticated", message: "Please sign in before checkout." });
  }

  const authUser = await resolveCheckoutAuth(req, payload);
  const priceId = getPlanPriceId(payload.planId, config);
  if (!priceId) return sendJson(res, 400, { error: "invalid_plan", message: "That paid plan is not available." });

  const stripe = getStripeClient(config);
  await requireMatchingStripePrice(stripe, {
    priceId,
    expectedCents: PLAN_PRICE_CENTS[payload.planId],
    recurring: true,
    offeringId: payload.planId,
    label: payload.planId
  });
  const customerId = authUser ? await ensureStripeCustomerForCheckout(authUser, config) : null;
  const appBaseUrl = getAppBaseUrl(req);
  const { successUrl, cancelUrl } = checkoutResultUrls(appBaseUrl, payload.planId, payload.context);

  const sessionParams = {
    mode: "subscription",
    ...(customerId ? { customer: customerId } : {}),
    ...(authUser ? { client_reference_id: authUser.userId } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: authUser
      ? { userId: authUser.userId, planId: payload.planId, checkoutContext: payload.context || "public" }
      : { planId: payload.planId, checkoutMode: "guest_test" },
    subscription_data: {
      metadata: authUser
        ? { userId: authUser.userId, planId: payload.planId, checkoutContext: payload.context || "public" }
        : { planId: payload.planId, checkoutMode: "guest_test" }
    }
  };

  if (authUser) {
    const pending = await getPendingReferralForUser(authUser.userId);
    if (pending) {
      const couponId = await getOrCreateReferralCoupon(stripe);
      sessionParams.discounts = [{ coupon: couponId }];
      sessionParams.metadata.referralId = pending.id;
      sessionParams.subscription_data.metadata.referralId = pending.id;
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  sendJson(res, 200, { url: session.url });
}

async function handleBundleCheckout(req, res) {
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  const payload = bundleCheckoutSchema.parse(await readJsonBody(req));
  if (payload.context === "onboarding" && !req.headers.authorization) {
    return sendJson(res, 401, { error: "unauthenticated", message: "Please sign in before checkout." });
  }

  const quote = quoteBundleSelection(payload);
  if (!quote.ok) {
    return sendJson(res, 400, { error: quote.error || "validation_error", message: quote.message });
  }
  if (!quote.totalCents || quote.totalCents < 50) {
    return sendJson(res, 400, { error: "invalid_amount", message: "That bundle total is too low to checkout." });
  }

  const authUser = await resolveCheckoutAuth(req, payload);
  const stripe = getStripeClient(config);
  const quantity = Object.values(quote.selection.quantities)[0];
  const priceId = getBundlePriceId(quote.selection.bundleId, quantity, config);
  if (!priceId) {
    return sendJson(res, 400, { error: "invalid_bundle", message: "That bundle is not available for checkout." });
  }
  await requireMatchingStripePrice(stripe, {
    priceId,
    expectedCents: quote.totalCents,
    recurring: false,
    offeringId: quote.selection.bundleId,
    label: `${quote.selection.bundleId} (${quantity})`
  });
  const customerId = authUser ? await ensureStripeCustomerForCheckout(authUser, config) : null;
  const appBaseUrl = getAppBaseUrl(req);
  const purchaseKey = `bundle_${quote.selection.bundleId}`;
  const { successUrl, cancelUrl } = checkoutResultUrls(appBaseUrl, purchaseKey, payload.context);
  const metadata = {
    ...serializeBundleMetadata(quote),
    ...(authUser
      ? { userId: authUser.userId, checkoutContext: payload.context || "public" }
      : { checkoutMode: "guest_test" })
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(customerId ? { customer: customerId } : {}),
    ...(authUser ? { client_reference_id: authUser.userId } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata
  });

  sendJson(res, 200, { url: session.url, totalCents: quote.totalCents, bundleId: quote.selection.bundleId });
}

async function handleConfirmSession(req, res) {
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  const payload = confirmSessionSchema.parse(await readJsonBody(req));
  const { user } = await requireSupabaseUser(req);
  const stripe = getStripeClient(config);
  const session = await stripe.checkout.sessions.retrieve(payload.sessionId);

  const sessionUserId = session.metadata?.userId || session.client_reference_id;
  if (!sessionUserId || sessionUserId !== user.id) {
    return sendJson(res, 403, { error: "forbidden", message: "That checkout session does not belong to this account." });
  }

  if (session.payment_status !== "paid") {
    return sendJson(res, 409, {
      error: "payment_pending",
      message: "Stripe has not confirmed payment for this checkout session yet.",
      paymentStatus: session.payment_status
    });
  }

  await syncSupabaseCheckoutSession(session);
  sendJson(res, 200, {
    confirmed: true,
    planId: session.metadata?.planId || null,
    paymentStatus: session.payment_status
  });
}

async function handlePortal(req, res) {
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  const auth = await requireAuth(req);
  requireCsrf(req);
  if (!auth.user.stripeCustomerId) {
    return sendJson(res, 400, { error: "billing_customer_missing", message: "No billing profile exists for this account yet." });
  }

  const stripe = getStripeClient(config);
  const session = await stripe.billingPortal.sessions.create({
    customer: auth.user.stripeCustomerId,
    return_url: `${getAppBaseUrl(req)}/dashboard`
  });

  sendJson(res, 200, { url: session.url });
}

async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  return await new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding?.("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) reject(new Error("Request body too large"));
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function normalizePlan(planId) {
  return PAID_PLAN_IDS.includes(planId) ? planId.toUpperCase() : "BASIC";
}

async function findUserForSubscription(subscription) {
  const userId = subscription.metadata?.userId;
  if (userId) {
    const user = await db().user.findUnique({ where: { id: userId } });
    if (user) return user;
  }
  if (subscription.id) {
    const user = await db().user.findUnique({ where: { stripeSubscriptionId: subscription.id } });
    if (user) return user;
  }
  const customerId = stripeObjectId(subscription.customer);
  if (customerId) {
    return await db().user.findUnique({ where: { stripeCustomerId: customerId } });
  }
  return null;
}

function resolvePlanIdFromSubscription(subscription, config = getBillingConfig()) {
  const metadataPlanId = subscription.metadata?.planId;
  if (PAID_PLAN_IDS.includes(metadataPlanId)) return metadataPlanId;
  for (const item of subscription.items?.data || []) {
    const planId = getPlanIdForPriceId(stripeObjectId(item.price), config);
    if (planId) return planId;
  }
  return null;
}

function subscriptionPeriodEnd(subscription) {
  if (subscription.current_period_end) return subscription.current_period_end;
  const periodEnds = (subscription.items?.data || [])
    .map((item) => item.current_period_end)
    .filter(Number.isFinite);
  return periodEnds.length ? Math.max(...periodEnds) : null;
}

async function syncSubscription(subscription) {
  const config = getBillingConfig();
  const planId = resolvePlanIdFromSubscription(subscription, config);
  await syncSupabaseSubscription(subscription, planId);

  const user = await findUserForSubscription(subscription);
  if (!user) return;

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  const periodEndTimestamp = subscriptionPeriodEnd(subscription);
  const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : null;

  await db().user.update({
    where: { id: user.id },
    data: {
      plan: active ? (planId ? normalizePlan(planId) : user.plan) : "BASIC",
      stripeCustomerId: stripeObjectId(subscription.customer) || user.stripeCustomerId,
      stripeSubscriptionId: subscription.id || user.stripeSubscriptionId,
      subscriptionStatus: subscription.status || null,
      subscriptionCurrentPeriodEnd: periodEnd
    }
  });
}

async function recordWebhookEvent(event) {
  try {
    await db().stripeWebhookEvent.create({ data: { id: event.id, eventType: event.type, payload: event } });
    return true;
  } catch (error) {
    if (error.code === "P2002") return false;
    throw error;
  }
}

async function processWebhookEvent(event) {
  const object = event.data?.object;
  if (!object) return;
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await syncSubscription(object);
  }
  if (event.type === "checkout.session.completed") {
    await syncSupabaseCheckoutSession(object);
    const userId = object.metadata?.userId || object.client_reference_id;
    const customerId = stripeObjectId(object.customer);
    const subscriptionId = stripeObjectId(object.subscription);
    const planId = object.metadata?.planId;
    if (userId && PAID_PLAN_IDS.includes(planId)) {
      try {
        await db().user.update({
          where: { id: userId },
          data: {
            plan: normalizePlan(planId),
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: object.status || "checkout_completed"
          }
        });
      } catch {
        /* Supabase-only accounts may not exist in Prisma */
      }
    }
  }
  const invoiceSubscriptionId = stripeObjectId(object.subscription) ||
    stripeObjectId(object.parent?.subscription_details?.subscription);
  if (["invoice.paid", "invoice.payment_succeeded"].includes(event.type) && invoiceSubscriptionId) {
    const stripe = getStripeClient();
    const subscriptionId = invoiceSubscriptionId;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription);

    const userId = subscription.metadata?.userId;
    const paymentId = object.payment_intent
      ? stripeObjectId(object.payment_intent)
      : object.id;
    if (userId && invoiceIsQualifyingFirstPayment(object)) {
      await confirmReferralFromPayment({
        userId,
        subscriptionId,
        qualifyingPaymentId: paymentId,
        invoiceId: object.id
      });
    }

    if (invoiceHasReferralDiscount(object) && subscription.metadata?.preludeReferralReward === "true") {
      const supabase = getSupabaseAdmin();
      let householdId = null;
      if (userId && supabase) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("household_id")
          .eq("id", userId)
          .maybeSingle();
        householdId = profile?.household_id || null;
      }
      const rewardId = subscription.metadata?.referralRewardId || null;
      if (rewardId) {
        await markRewardApplied({ rewardId, invoiceId: object.id });
      } else {
        await markRewardAppliedBySubscription({
          subscriptionId,
          invoiceId: object.id,
          householdId
        });
      }
    }
  }
  if (event.type === "invoice.payment_failed" && invoiceSubscriptionId) {
    const stripe = getStripeClient();
    const subscriptionId = invoiceSubscriptionId;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription);
  }

  if (["charge.refunded", "charge.dispute.created", "invoice.voided"].includes(event.type)) {
    const paymentId =
      stripeObjectId(object.payment_intent) ||
      (event.type.startsWith("charge.") ? object.id : null) ||
      object.id;
    if (paymentId) {
      await revokeRewardsForQualifyingPayment(paymentId, event.type);
    }
  }
}

async function handleWebhook(req, res) {
  const config = getBillingConfig();
  if (!config.webhookEnabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  const rawBody = await readRawBody(req);
  const signature = req.headers["stripe-signature"];
  const stripe = getStripeClient(config);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
  } catch {
    return sendJson(res, 400, { error: "invalid_signature", message: "Stripe webhook signature verification failed." });
  }

  const shouldProcess = await recordWebhookEvent(event);
  if (shouldProcess) await processWebhookEvent(event);
  sendJson(res, 200, { received: true, duplicate: !shouldProcess });
}

export function createBillingApiMiddleware() {
  return async function billingApiMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (!isBillingPath(url.pathname)) return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, Stripe-Signature");
      res.end();
      return;
    }

    try {
      if (url.pathname === "/api/billing/config" && req.method === "GET") return await handleConfig(req, res);
      if (url.pathname === "/api/billing/checkout" && req.method === "POST") return await handleCheckout(req, res);
      if (url.pathname === "/api/billing/bundle-checkout" && req.method === "POST") return await handleBundleCheckout(req, res);
      if (url.pathname === "/api/billing/confirm-session" && req.method === "POST") return await handleConfirmSession(req, res);
      if (url.pathname === "/api/billing/portal" && req.method === "POST") return await handlePortal(req, res);
      if (url.pathname === "/api/billing/webhook" && req.method === "POST") return await handleWebhook(req, res);
      return sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof z.ZodError) return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-billing-api]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Billing request failed."
      });
    }
  };
}

const middleware = createBillingApiMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => {
    sendJson(res, 404, { error: "not_found" });
  });
}
