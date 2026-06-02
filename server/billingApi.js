import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, readJsonBody, requireAuth, requireCsrf, sendJson } from "./authApi.js";
import { billingNotConfiguredPayload, getAppBaseUrl, getBillingConfig, getPlanPriceId, PAID_PLAN_IDS } from "./billingConfig.js";

const checkoutSchema = z.object({ planId: z.enum(["plus", "pro"]) });
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function isBillingPath(pathname) {
  return pathname === "/api/billing/config" || pathname === "/api/billing/checkout" || pathname === "/api/billing/portal" || pathname === "/api/billing/webhook";
}

function toStripeForm(params) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  return form;
}

async function stripeRequest(path, params, config) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: toStripeForm(params)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Stripe request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function ensureStripeCustomer(user, config) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripeRequest(
    "/customers",
    {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      "metadata[userId]": user.id
    },
    config
  );
  await db().user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

async function handleConfig(_req, res) {
  const config = getBillingConfig();
  sendJson(res, 200, {
    provider: config.provider,
    enabled: config.enabled,
    webhookEnabled: config.webhookEnabled,
    paidPlans: PAID_PLAN_IDS
  });
}

async function handleCheckout(req, res) {
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  requireCsrf(req);
  const auth = await requireAuth(req);
  const payload = checkoutSchema.parse(await readJsonBody(req));
  const priceId = getPlanPriceId(payload.planId, config);
  if (!priceId) return sendJson(res, 400, { error: "invalid_plan", message: "That paid plan is not available." });

  const customerId = await ensureStripeCustomer(auth.user, config);
  const appBaseUrl = getAppBaseUrl(req);
  const session = await stripeRequest(
    "/checkout/sessions",
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: auth.user.id,
      success_url: `${appBaseUrl}/?checkout=success&plan=${payload.planId}#dashboard`,
      cancel_url: `${appBaseUrl}/?checkout=cancelled#pricing`,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      "metadata[userId]": auth.user.id,
      "metadata[planId]": payload.planId,
      "subscription_data[metadata][userId]": auth.user.id,
      "subscription_data[metadata][planId]": payload.planId
    },
    config
  );

  sendJson(res, 200, { url: session.url });
}

async function handlePortal(req, res) {
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  requireCsrf(req);
  const auth = await requireAuth(req);
  if (!auth.user.stripeCustomerId) {
    return sendJson(res, 400, { error: "billing_customer_missing", message: "No billing profile exists for this account yet." });
  }

  const session = await stripeRequest(
    "/billing_portal/sessions",
    {
      customer: auth.user.stripeCustomerId,
      return_url: `${getAppBaseUrl(req)}/#dashboard`
    },
    config
  );

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

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const actual = parts.v1;
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
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
  if (subscription.customer) {
    return await db().user.findUnique({ where: { stripeCustomerId: subscription.customer } });
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
      stripeCustomerId: subscription.customer || user.stripeCustomerId,
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
    if (userId) {
      await db().user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: object.customer,
          stripeSubscriptionId: object.subscription,
          subscriptionStatus: object.status || "checkout_completed"
        }
      });
    }
  }
}

async function handleWebhook(req, res) {
  const config = getBillingConfig();
  if (!config.webhookEnabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  const rawBody = await readRawBody(req);
  const signature = req.headers["stripe-signature"];
  if (!verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret)) {
    return sendJson(res, 400, { error: "invalid_signature", message: "Stripe webhook signature verification failed." });
  }

  const event = JSON.parse(rawBody);
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
