import Stripe from "stripe";
import { z } from "zod";
import { db, readJsonBody, requireAuth, requireCsrf, sendJson } from "./authApi.js";
import {
  billingNotConfiguredPayload,
  getAppBaseUrl,
  getBillingConfig,
  getPlanPriceId,
  isGuestCheckoutAllowed,
  PAID_PLAN_IDS,
  STRIPE_API_VERSION
} from "./billingConfig.js";

const checkoutSchema = z.object({
  planId: z.enum(["basic", "plus", "pro"]),
  guestCheckout: z.boolean().optional()
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

function isBillingPath(pathname) {
  return pathname === "/api/billing/config" || pathname === "/api/billing/checkout" || pathname === "/api/billing/portal" || pathname === "/api/billing/webhook";
}

async function ensureStripeCustomer(user, config) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const stripe = getStripeClient(config);
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: { userId: user.id }
  });
  await db().user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
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
  const guestCheckout = Boolean(payload.guestCheckout) && isGuestCheckoutAllowed(req);
  const auth = guestCheckout ? null : await requireAuth(req);
  if (!guestCheckout) requireCsrf(req);
  const priceId = getPlanPriceId(payload.planId, config);
  if (!priceId) return sendJson(res, 400, { error: "invalid_plan", message: "That paid plan is not available." });

  const stripe = getStripeClient(config);
  const customerId = auth ? await ensureStripeCustomer(auth.user, config) : null;
  const appBaseUrl = getAppBaseUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(customerId ? { customer: customerId } : {}),
    ...(auth ? { client_reference_id: auth.user.id } : {}),
    success_url: `${appBaseUrl}/checkout/success?plan=${payload.planId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl}/checkout/cancel?plan=${payload.planId}`,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: auth ? { userId: auth.user.id, planId: payload.planId } : { planId: payload.planId, checkoutMode: "guest_test" },
    subscription_data: {
      metadata: auth ? { userId: auth.user.id, planId: payload.planId } : { planId: payload.planId, checkoutMode: "guest_test" }
    }
  });

  sendJson(res, 200, { url: session.url });
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

async function syncSubscription(subscription) {
  const user = await findUserForSubscription(subscription);
  if (!user) return;

  const planId = subscription.metadata?.planId;
  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;

  await db().user.update({
    where: { id: user.id },
    data: {
      plan: active ? normalizePlan(planId) : "BASIC",
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
  if (event.type === "checkout.session.completed" && object.customer && object.subscription) {
    const userId = object.metadata?.userId || object.client_reference_id;
    const customerId = stripeObjectId(object.customer);
    const subscriptionId = stripeObjectId(object.subscription);
    if (userId) {
      const planId = object.metadata?.planId;
      await db().user.update({
        where: { id: userId },
        data: {
          plan: normalizePlan(planId),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: object.status || "checkout_completed"
        }
      });
    }
  }
  if (["invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"].includes(event.type) && object.subscription) {
    const stripe = getStripeClient();
    const subscriptionId = stripeObjectId(object.subscription);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription);
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
      if (url.pathname === "/api/billing/portal" && req.method === "POST") return await handlePortal(req, res);
      if (url.pathname === "/api/billing/webhook" && req.method === "POST") return await handleWebhook(req, res);
      return sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof z.ZodError) return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-billing-api]", error);
      return sendJson(res, statusCode, {
        error: statusCode >= 500 ? "server_error" : "request_failed",
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
