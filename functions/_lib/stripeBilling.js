const PAID_PLAN_IDS = ["basic", "plus", "pro"];
const STRIPE_API_VERSION = "2026-05-27.dahlia";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

const PRICE_ENV_BY_PLAN = {
  basic: "STRIPE_PRICE_ID_BASIC",
  plus: "STRIPE_PRICE_ID_PLUS",
  pro: "STRIPE_PRICE_ID_PRO"
};

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function getEnv(context, name) {
  return context.env?.[name] || "";
}

function getBillingConfig(context) {
  const provider = (getEnv(context, "BILLING_PROVIDER") || "disabled").toLowerCase();
  const stripeSecretKey = getEnv(context, "STRIPE_SECRET_KEY").trim();
  const stripeWebhookSecret = getEnv(context, "STRIPE_WEBHOOK_SECRET").trim();
  const stripePublishableKey = getEnv(context, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") || getEnv(context, "STRIPE_PUBLISHABLE_KEY");
  const prices = {
    basic: getEnv(context, "STRIPE_PRICE_ID_BASIC") || getEnv(context, "STRIPE_PRICE_BASIC_MONTHLY"),
    plus: getEnv(context, "STRIPE_PRICE_ID_PLUS") || getEnv(context, "STRIPE_PRICE_PLUS_MONTHLY"),
    pro: getEnv(context, "STRIPE_PRICE_ID_PRO") || getEnv(context, "STRIPE_PRICE_PRO_MONTHLY")
  };

  const missing = [];
  if (provider === "stripe") {
    if (!stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
    for (const planId of PAID_PLAN_IDS) {
      if (!prices[planId]) missing.push(PRICE_ENV_BY_PLAN[planId]);
    }
  }

  return {
    provider,
    enabled: provider === "stripe" && missing.length === 0,
    webhookEnabled: provider === "stripe" && Boolean(stripeSecretKey) && Boolean(stripeWebhookSecret),
    missing,
    prices,
    stripePublishableKey,
    stripeSecretKey,
    stripeWebhookSecret
  };
}

function appBaseUrl(context) {
  const configured = getEnv(context, "PUBLIC_APP_URL").trim().replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(context.request.url);
  return `${url.protocol}//${url.host}`;
}

function billingNotConfiguredPayload(config) {
  return {
    error: "billing_not_configured",
    message: "Paid subscriptions are not connected yet. Please try again once billing is configured.",
    provider: config.provider,
    missing: config.provider === "stripe" ? config.missing : []
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function stripeObjectId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

async function stripeRequest(context, method, path, body = null) {
  const config = getBillingConfig(context);
  const headers = {
    Authorization: `Bearer ${config.stripeSecretKey}`,
    "Stripe-Version": STRIPE_API_VERSION
  };
  const init = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = body;
  }

  const response = await fetch(`https://api.stripe.com${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Stripe request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function verifyStripeSignature(rawBody, signatureHeader, signingSecret) {
  if (!signatureHeader || !signingSecret) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  if (!parts.t || !parts.v1) return false;
  const expected = await hmacSha256Hex(signingSecret, `${parts.t}.${rawBody}`);
  return timingSafeEqual(expected, parts.v1);
}

async function patchSupabaseProfile(context, userId, data) {
  const supabaseUrl = getEnv(context, "SUPABASE_URL") || getEnv(context, "VITE_SUPABASE_URL");
  const serviceRoleKey = getEnv(context, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !userId) return;

  await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(data)
  });
}

async function patchSupabaseOnboarding(context, userId, data) {
  const supabaseUrl = getEnv(context, "SUPABASE_URL") || getEnv(context, "VITE_SUPABASE_URL");
  const serviceRoleKey = getEnv(context, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !userId) return;

  await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/onboarding_progress?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({ user_id: userId, ...data })
  });
}

async function syncSupabasePaymentComplete(context, userId, {
  planId,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  subscriptionStatus = "active"
} = {}) {
  if (!userId || !planId) return;

  await patchSupabaseProfile(context, userId, {
    plan_id: planId,
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
    ...(subscriptionStatus ? { subscription_status: subscriptionStatus } : {})
  });

  await patchSupabaseOnboarding(context, userId, {
    payment_step_completed: true,
    pending_checkout_plan_id: null,
    onboarding_status: "onboarding_completed",
    updated_at: new Date().toISOString()
  });
}

async function syncSubscription(context, subscription) {
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;
  if (!userId || !planId) return;
  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  await syncSupabasePaymentComplete(context, userId, {
    planId: active ? planId : "basic",
    stripeCustomerId: stripeObjectId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status || null
  });
}

async function syncCheckoutSession(context, session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  const planId = session.metadata?.planId;
  if (!userId || !planId) return;
  if (session.payment_status && session.payment_status !== "paid") return;

  await syncSupabasePaymentComplete(context, userId, {
    planId,
    stripeCustomerId: stripeObjectId(session.customer),
    stripeSubscriptionId: stripeObjectId(session.subscription),
    subscriptionStatus: session.status || "checkout_completed"
  });
}

async function requireSupabaseUser(context) {
  const token = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) {
    return json({ error: "unauthenticated", message: "Please sign in before checkout." }, 401);
  }

  const supabaseUrl = getEnv(context, "SUPABASE_URL") || getEnv(context, "VITE_SUPABASE_URL");
  const anonKey = getEnv(context, "SUPABASE_ANON_KEY") || getEnv(context, "VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) {
    return json({ error: "service_unavailable", message: "Supabase is not configured." }, 503);
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    return json({ error: "unauthenticated", message: "Please sign in before checkout." }, 401);
  }

  return { user: payload, token };
}

async function processWebhookEvent(context, event) {
  const object = event.data?.object;
  if (!object) return;

  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await syncSubscription(context, object);
  }

  if (event.type === "checkout.session.completed") {
    await syncCheckoutSession(context, object);
  }

  if (["invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"].includes(event.type) && object.subscription) {
    const subscriptionId = stripeObjectId(object.subscription);
    if (subscriptionId) {
      const subscription = await stripeRequest(context, "GET", `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
      await syncSubscription(context, subscription);
    }
  }
}

function checkoutResultUrls(baseUrl, planId, context) {
  const contextQuery = context === "onboarding" ? "&context=onboarding" : "";
  return {
    successUrl: `${baseUrl}/checkout/success?plan=${planId}${contextQuery}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/checkout/cancel?plan=${planId}${contextQuery}`
  };
}

export async function handleBillingConfig(context) {
  const config = getBillingConfig(context);
  return json({
    provider: config.provider,
    enabled: config.enabled,
    webhookEnabled: config.webhookEnabled,
    publishableKey: config.stripePublishableKey,
    paidPlans: PAID_PLAN_IDS
  });
}

export async function handleBillingCheckout(context) {
  const config = getBillingConfig(context);
  if (!config.enabled) return json(billingNotConfiguredPayload(config), 503);

  const payload = await readJson(context.request);
  const planId = String(payload.planId || "").toLowerCase();
  const checkoutContext = payload.context === "onboarding" ? "onboarding" : "public";
  if (!PAID_PLAN_IDS.includes(planId)) {
    return json({ error: "invalid_plan", message: "That paid plan is not available." }, 400);
  }

  let authUser = null;
  const authResult = await requireSupabaseUser(context);
  if (authResult instanceof Response) {
    if (checkoutContext === "onboarding") return authResult;
    if (getEnv(context, "STRIPE_ALLOW_GUEST_CHECKOUT") !== "true") {
      return json({ error: "unauthenticated", message: "Please sign in before checkout." }, 401);
    }
  } else {
    authUser = authResult.user;
  }

  const baseUrl = appBaseUrl(context);
  const { successUrl, cancelUrl } = checkoutResultUrls(baseUrl, planId, checkoutContext);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("line_items[0][price]", config.prices[planId]);
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[planId]", planId);
  params.set("metadata[checkoutContext]", checkoutContext);
  params.set("subscription_data[metadata][planId]", planId);
  params.set("subscription_data[metadata][checkoutContext]", checkoutContext);

  if (authUser) {
    params.set("client_reference_id", authUser.id);
    params.set("metadata[userId]", authUser.id);
    params.set("subscription_data[metadata][userId]", authUser.id);
    params.set("customer_email", authUser.email || "");
  } else {
    params.set("metadata[checkoutMode]", "cloudflare_guest");
    params.set("subscription_data[metadata][checkoutMode]", "cloudflare_guest");
  }

  const session = await stripeRequest(context, "POST", "/v1/checkout/sessions", params);
  return json({ url: session.url });
}

export async function handleBillingConfirmSession(context) {
  const config = getBillingConfig(context);
  if (!config.enabled) return json(billingNotConfiguredPayload(config), 503);

  const authResult = await requireSupabaseUser(context);
  if (authResult instanceof Response) return authResult;

  const payload = await readJson(context.request);
  const sessionId = String(payload.sessionId || "").trim();
  if (!sessionId) {
    return json({ error: "validation_error", message: "sessionId is required." }, 400);
  }

  const session = await stripeRequest(
    context,
    "GET",
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`
  );

  const sessionUserId = session.metadata?.userId || session.client_reference_id;
  if (!sessionUserId || sessionUserId !== authResult.user.id) {
    return json({ error: "forbidden", message: "That checkout session does not belong to this account." }, 403);
  }

  if (session.payment_status !== "paid") {
    return json({
      error: "payment_pending",
      message: "Stripe has not confirmed payment for this checkout session yet.",
      paymentStatus: session.payment_status
    }, 409);
  }

  await syncCheckoutSession(context, session);
  return json({
    confirmed: true,
    planId: session.metadata?.planId || null,
    paymentStatus: session.payment_status
  });
}

export async function handleBillingPortal() {
  return json({
    error: "billing_customer_missing",
    message: "No billing profile exists for this account yet."
  }, 400);
}

export async function handleBillingWebhook(context) {
  const config = getBillingConfig(context);
  if (!config.webhookEnabled) return json(billingNotConfiguredPayload(config), 503);

  const rawBody = await context.request.text();
  const signature = context.request.headers.get("stripe-signature");
  const verified = await verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret);
  if (!verified) {
    return json({ error: "invalid_signature", message: "Stripe webhook signature verification failed." }, 400);
  }

  const event = JSON.parse(rawBody);
  await processWebhookEvent(context, event);
  return json({ received: true });
}
