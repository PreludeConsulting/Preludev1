import { createSupabaseAdmin } from "../../server/lib/supabasePasswordReset.js";
import { REFERRAL_DISCOUNT_PERCENT, REFERRAL_REWARD_NOTIFICATION, isReferralEligibleRole, logReferralEvent } from "../../shared/referralConstants.js";
import {
  BUNDLE_PRICE_ENV_BY_ID,
  PLAN_PRICE_CENTS,
  PLAN_PRICE_ENV_BY_ID
} from "../../shared/billingCatalog.js";
import {
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful
} from "../../shared/stripePaymentLinks.js";
import {
  hasActiveProEntitlement,
  PLUS_BLOCKED_BY_PRO_MESSAGE
} from "../../shared/billingMembership.js";

const PAID_PLAN_IDS = ["basic", "plus", "pro"];
const PURCHASABLE_PLAN_IDS = ["plus", "pro"];
const STRIPE_API_VERSION = "2026-05-27.dahlia";
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

const PLACEHOLDER_PRICE_ID = /placeholder|replace|change[-_]?me|example|todo|your[-_]?price|x{3,}/i;

function isConfiguredStripePriceId(value) {
  const priceId = String(value || "").trim();
  return /^price_[A-Za-z0-9]+$/.test(priceId) && !PLACEHOLDER_PRICE_ID.test(priceId);
}

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
  const bundlePrices = Object.fromEntries(
    Object.entries(BUNDLE_PRICE_ENV_BY_ID).map(([bundleId, quantityMap]) => [
      bundleId,
      Object.fromEntries(
        Object.entries(quantityMap).map(([quantity, envKey]) => [quantity, getEnv(context, envKey)])
      )
    ])
  );

  const missing = [];
  if (provider === "stripe") {
    if (!stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
    for (const planId of PURCHASABLE_PLAN_IDS) {
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
    enabled: provider === "stripe" && missing.length === 0,
    webhookEnabled: provider === "stripe" && Boolean(stripeSecretKey) && Boolean(stripeWebhookSecret),
    missing,
    prices,
    bundlePrices,
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

function planIdForPriceId(priceId, config) {
  return PAID_PLAN_IDS.find((planId) => config.prices[planId] === priceId) || null;
}

async function configuredPriceMatches(context, { priceId, expectedCents, recurring, offeringId }) {
  if (!isConfiguredStripePriceId(priceId)) return false;
  let price;
  try {
    price = await stripeRequest(
      context,
      "GET",
      `/v1/prices/${encodeURIComponent(priceId)}?expand%5B%5D=product`
    );
  } catch {
    return false;
  }
  const cadenceMatches = recurring
    ? price.type === "recurring" && price.recurring?.interval === "month" && price.recurring?.interval_count === 1
    : price.type === "one_time" && !price.recurring;
  const productOfferingId = typeof price.product === "object"
    ? price.product.metadata?.preludeOfferingId || price.product.metadata?.preludePlanId
    : null;
  return Boolean(price.active) &&
    price.currency?.toLowerCase() === "usd" &&
    price.unit_amount === expectedCents &&
    cadenceMatches &&
    productOfferingId === offeringId;
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
  const entries = signatureHeader.split(",").map((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return null;
    return [part.slice(0, eq), part.slice(eq + 1)];
  }).filter(Boolean);
  const timestamp = entries.find(([key]) => key === "t")?.[1];
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length) return false;

  // Reject stale signatures (Stripe default tolerance is 5 minutes).
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = await hmacSha256Hex(signingSecret, `${timestamp}.${rawBody}`);
  return signatures.some((candidate) => timingSafeEqual(expected, candidate));
}

async function claimBillingWebhookEvent(context, eventId, eventType, payload = {}) {
  if (!eventId) return true;
  try {
    await supabaseRest(context, "billing_webhook_events", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        id: eventId,
        event_type: eventType,
        payload
      }
    });
    return true;
  } catch (error) {
    const details = error?.details || {};
    const code = details.code || details?.error || "";
    const message = String(error?.message || details?.message || "");
    if (code === "23505" || /duplicate|unique/i.test(message)) {
      console.info("[stripe-billing] webhook_duplicate_prevented", { eventId, eventType });
      return false;
    }
    // Table may be missing in some envs — process rather than drop events.
    if (/billing_webhook_events|schema cache|does not exist/i.test(message)) return true;
    throw error;
  }
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
  planId = null,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  stripePriceId = null,
  subscriptionStatus = undefined,
  subscriptionCurrentPeriodStart = null,
  subscriptionCurrentPeriodEnd = null,
  subscriptionCancelAtPeriodEnd = null,
  subscriptionCanceledAt = null,
  pendingPlanId = undefined,
  entitlementEndsAt = null
} = {}) {
  if (!userId) return;

  const profilePatch = {
    ...(planId ? { plan_id: planId } : {}),
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
    ...(stripePriceId ? { stripe_price_id: stripePriceId } : {}),
    ...(subscriptionStatus != null ? { subscription_status: subscriptionStatus } : {}),
    ...(subscriptionCurrentPeriodStart != null
      ? { subscription_current_period_start: subscriptionCurrentPeriodStart }
      : {}),
    ...(subscriptionCurrentPeriodEnd != null
      ? { subscription_current_period_end: subscriptionCurrentPeriodEnd }
      : {}),
    ...(subscriptionCancelAtPeriodEnd != null
      ? { subscription_cancel_at_period_end: Boolean(subscriptionCancelAtPeriodEnd) }
      : {}),
    ...(subscriptionCanceledAt !== undefined
      ? { subscription_canceled_at: subscriptionCanceledAt }
      : {}),
    ...(pendingPlanId !== undefined ? { pending_plan_id: pendingPlanId } : {}),
    ...(entitlementEndsAt != null ? { entitlement_ends_at: entitlementEndsAt } : {})
  };
  if (Object.keys(profilePatch).length > 0) {
    await patchSupabaseProfile(context, userId, profilePatch);
  }

  await patchSupabaseOnboarding(context, userId, {
    payment_step_completed: true,
    pending_checkout_plan_id: null,
    onboarding_status: "onboarding_completed",
    updated_at: new Date().toISOString()
  });
}

function subscriptionPeriodIso(subscription, field) {
  const stamp = subscription?.[field];
  if (!stamp) return null;
  return new Date(stamp * 1000).toISOString();
}

function resolveSubscriptionPriceId(subscription) {
  const items = subscription?.items?.data || [];
  const recurring = items.find((item) => item.price?.type === "recurring" || item.price?.recurring) || items[0];
  return stripeObjectId(recurring?.price);
}

async function syncSubscription(context, subscription, { paymentConfirmed = false } = {}) {
  let userId = subscription.metadata?.userId || null;
  let priorPlanId = null;
  if (!userId) {
    const customerId = stripeObjectId(subscription.customer);
    if (customerId) {
      try {
        const rows = await supabaseRest(
          context,
          `profiles?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id,plan_id,pending_plan_id&limit=1`,
          { method: "GET", prefer: "return=representation" }
        );
        userId = Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
        priorPlanId = Array.isArray(rows) && rows[0]?.plan_id ? String(rows[0].plan_id).toLowerCase() : null;
      } catch {
        userId = null;
      }
    }
  } else {
    try {
      const rows = await supabaseRest(
        context,
        `profiles?id=eq.${encodeURIComponent(userId)}&select=plan_id,pending_plan_id&limit=1`,
        { method: "GET", prefer: "return=representation" }
      );
      priorPlanId = Array.isArray(rows) && rows[0]?.plan_id ? String(rows[0].plan_id).toLowerCase() : null;
    } catch {
      priorPlanId = null;
    }
  }
  const config = getBillingConfig(context);
  const metadataPlanId = subscription.metadata?.planId;
  const planId = PAID_PLAN_IDS.includes(metadataPlanId)
    ? metadataPlanId
    : (subscription.items?.data || [])
      .map((item) => planIdForPriceId(stripeObjectId(item.price), config))
      .find(Boolean);
  if (!userId || !planId) return;

  const status = subscription.status || null;
  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
  const periodStart = subscriptionPeriodIso(subscription, "current_period_start");
  const periodEnd = subscriptionPeriodIso(subscription, "current_period_end");
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const priceId = resolveSubscriptionPriceId(subscription);

  // Preserve Pro access through cancel_at_period_end; never schedule Pro→Plus downgrades.
  let activePlanId = active ? planId : null;
  let pendingPlanId = null;
  const metadataPending = String(subscription.metadata?.pendingPlanId || "").toLowerCase();
  if (metadataPending === "pro") {
    pendingPlanId = "pro";
  }

  // Plus→Pro price change must not unlock Pro until a paid invoice confirms it.
  const pendingUpgrade =
    String(subscription.metadata?.pendingUpgrade || "").toLowerCase() === "true" ||
    (priorPlanId === "plus" && planId === "pro" && !paymentConfirmed);
  if (active && pendingUpgrade && !paymentConfirmed) {
    activePlanId = "plus";
    pendingPlanId = "pro";
  }
  if (active && planId === "pro" && paymentConfirmed) {
    activePlanId = "pro";
    pendingPlanId = null;
  }

  // Canceled but still within paid Pro window — keep Pro entitlement.
  if (
    !active &&
    priorPlanId === "pro" &&
    periodEnd &&
    new Date(periodEnd).getTime() > Date.now() &&
    (status === "canceled" || status === "unpaid" || cancelAtPeriodEnd)
  ) {
    activePlanId = "pro";
  }

  await syncSupabasePaymentComplete(context, userId, {
    planId: activePlanId || undefined,
    stripeCustomerId: stripeObjectId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    subscriptionStatus: status,
    subscriptionCurrentPeriodStart: periodStart,
    subscriptionCurrentPeriodEnd: periodEnd,
    subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
    subscriptionCanceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : cancelAtPeriodEnd
        ? new Date().toISOString()
        : null,
    pendingPlanId,
    entitlementEndsAt: periodEnd
  });

  // Credits only reset after a confirmed paid upgrade/period — never on unpaid subscription.updated.
  if (active && paymentConfirmed && activePlanId === "pro" && (priorPlanId === "plus" || priorPlanId === "pro")) {
    try {
      const rows = await supabaseRest(
        context,
        `subscription_session_periods?student_user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id,allowance,remaining,plan_id&order=period_start.desc&limit=1`,
        { method: "GET", prefer: "return=representation" }
      );
      const period = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (period?.id && (priorPlanId === "plus" || Number(period.allowance) !== 4)) {
        await supabaseRest(
          context,
          `subscription_session_periods?id=eq.${encodeURIComponent(period.id)}`,
          {
            method: "PATCH",
            prefer: "return=minimal",
            body: {
              plan_id: "pro",
              allowance: 4,
              remaining: 4,
              updated_at: new Date().toISOString()
            }
          }
        );
      }
    } catch (creditError) {
      console.error("[stripe-billing] session credit reconcile failed", creditError?.message || creditError);
    }
  }
}

async function syncCheckoutSession(context, session) {
  const enriched = enrichCheckoutSessionFromPaymentLink(session);
  const userId = enriched.metadata?.userId || enriched.client_reference_id;
  const planId = enriched.metadata?.planId;
  const bundleId = String(enriched.metadata?.bundleId || "").trim();
  if (!userId || (!planId && !bundleId)) return;
  if (!isCheckoutPaymentSuccessful(enriched)) return;

  await syncSupabasePaymentComplete(context, userId, {
    planId: planId || null,
    stripeCustomerId: stripeObjectId(enriched.customer),
    ...(planId
      ? {
          stripeSubscriptionId: stripeObjectId(enriched.subscription),
          subscriptionStatus: enriched.status || "checkout_completed"
        }
      : {})
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

async function supabaseRest(context, path, { method = "GET", body = null, prefer = "return=representation" } = {}) {
  const supabaseUrl = getEnv(context, "SUPABASE_URL") || getEnv(context, "VITE_SUPABASE_URL");
  const serviceRoleKey = getEnv(context, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: prefer
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function loadPendingReferral(context, userId) {
  const profiles = await supabaseRest(
    context,
    `profiles?id=eq.${encodeURIComponent(userId)}&select=pending_referral_id`
  );
  const pendingId = Array.isArray(profiles) ? profiles[0]?.pending_referral_id : null;
  if (!pendingId) return null;
  const referrals = await supabaseRest(
    context,
    `referrals?id=eq.${encodeURIComponent(pendingId)}&select=id,status&status=in.(entered,pending_account,pending_payment)`
  );
  return Array.isArray(referrals) ? referrals[0] : null;
}

async function resolveReferralCouponId(context) {
  const configured = getEnv(context, "STRIPE_REFERRAL_COUPON_ID").trim();
  if (configured) return configured;
  try {
    const listed = await stripeRequest(context, "GET", "/v1/coupons?limit=100");
    const existing = (listed.data || []).find(
      (c) => c.id === "prelude_referral_20_once" || c.metadata?.preludeReferral === "true"
    );
    if (existing) return existing.id;
    const params = new URLSearchParams();
    params.set("id", "prelude_referral_20_once");
    params.set("percent_off", "20");
    params.set("duration", "once");
    params.set("name", "Prelude referral 20% (one month)");
    params.set("metadata[preludeReferral]", "true");
    const created = await stripeRequest(context, "POST", "/v1/coupons", params);
    return created.id;
  } catch {
    return null;
  }
}

async function confirmReferralPayment(context, { userId, subscriptionId, paymentId, invoiceId }) {
  const env = {
    SUPABASE_URL: getEnv(context, "SUPABASE_URL") || getEnv(context, "VITE_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: getEnv(context, "SUPABASE_SERVICE_ROLE_KEY")
  };
  const supabase = createSupabaseAdmin(env);
  if (!supabase || !userId || !paymentId) return null;

  const { data: byPayment } = await supabase
    .from("referrals")
    .select("*")
    .eq("qualifying_payment_id", paymentId)
    .maybeSingle();
  if (byPayment) {
    return { duplicate: true, referral: byPayment };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, pending_referral_id, household_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || !isReferralEligibleRole(profile.role)) return null;

  let referral = null;
  if (profile.pending_referral_id) {
    const { data } = await supabase.from("referrals").select("*").eq("id", profile.pending_referral_id).maybeSingle();
    referral = data;
  }
  if (!referral) {
    const { data } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_user_id", userId)
      .in("status", ["entered", "pending_account", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    referral = data;
  }
  if (!referral || !["entered", "pending_account", "pending_payment"].includes(referral.status)) {
    return null;
  }

  let referredHouseholdId = referral.referred_household_id || profile.household_id;
  if (!referredHouseholdId) {
    const { data } = await supabase.rpc("ensure_household_for_user", { p_user_id: userId });
    referredHouseholdId = data;
  }

  const { data: updated, error } = await supabase
    .from("referrals")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      qualifying_payment_id: paymentId,
      referred_subscription_id: subscriptionId || referral.referred_subscription_id,
      referred_household_id: referredHouseholdId,
      metadata: { ...(referral.metadata || {}), invoiceId: invoiceId || null }
    })
    .eq("id", referral.id)
    .in("status", ["entered", "pending_account", "pending_payment"])
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    const { data: race } = await supabase.from("referrals").select("*").eq("qualifying_payment_id", paymentId).maybeSingle();
    return race ? { duplicate: true, referral: race } : null;
  }

  await supabase.from("profiles").update({ pending_referral_id: null }).eq("id", userId);

  const { data: existingReward } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("referral_id", updated.id)
    .maybeSingle();
  let reward = existingReward;
  if (!reward) {
    const { data: createdReward } = await supabase
      .from("referral_rewards")
      .insert({
        referral_id: updated.id,
        household_id: updated.referrer_household_id,
        status: "available",
        discount_percent: REFERRAL_DISCOUNT_PERCENT,
        available_at: new Date().toISOString()
      })
      .select("*")
      .single();
    reward = createdReward;
  }

  if (reward) {
    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", reward.household_id);
    const notificationIds = [];
    for (const member of members || []) {
      const { data: notification } = await supabase
        .from("notifications")
        .insert({
          user_id: member.user_id,
          title: REFERRAL_REWARD_NOTIFICATION.title,
          body: REFERRAL_REWARD_NOTIFICATION.body,
          unread: true,
          action_type: "claim_referral_reward",
          action_payload: { rewardId: reward.id, householdId: reward.household_id }
        })
        .select("id")
        .single();
      if (notification?.id) notificationIds.push(notification.id);
    }
    if (notificationIds.length) {
      await supabase.from("referral_rewards").update({ notification_ids: notificationIds }).eq("id", reward.id);
    }
    logReferralEvent("referral_payment_confirmed", {
      referralId: updated.id,
      userId,
      qualifyingPaymentId: paymentId,
      rewardId: reward.id
    });
  }

  return {
    referral: updated,
    reward,
    async markRewardApplied({ rewardId, invoiceId: appliedInvoiceId }) {
      await supabase
        .from("referral_rewards")
        .update({
          status: "applied",
          applied_at: new Date().toISOString(),
          applied_invoice_id: appliedInvoiceId || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", rewardId)
        .in("status", ["claimed", "scheduled"]);
      logReferralEvent("reward_applied", { rewardId, invoiceId: appliedInvoiceId });
    }
  };
}

async function revokeReferralRewards(context, paymentId, reason) {
  const env = {
    SUPABASE_URL: getEnv(context, "SUPABASE_URL") || getEnv(context, "VITE_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: getEnv(context, "SUPABASE_SERVICE_ROLE_KEY")
  };
  const supabase = createSupabaseAdmin(env);
  if (!supabase || !paymentId) return;
  const { data: referral } = await supabase
    .from("referrals")
    .select("id")
    .eq("qualifying_payment_id", paymentId)
    .maybeSingle();
  if (!referral) return;
  const { data: rewards } = await supabase
    .from("referral_rewards")
    .select("id, status")
    .eq("referral_id", referral.id)
    .in("status", ["available", "claimed", "scheduled"]);
  for (const reward of rewards || []) {
    await supabase
      .from("referral_rewards")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", reward.id);
    logReferralEvent("reward_revoked", { rewardId: reward.id, reason, qualifyingPaymentId: paymentId });
  }
}

async function processWebhookEvent(context, event) {
  const object = event.data?.object;
  if (!object) return;

  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await syncSubscription(context, object);
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = enrichCheckoutSessionFromPaymentLink(object);
    await syncCheckoutSession(context, session);
    const { fulfillEssaySupportCheckout, fulfillFlexibleSessionCheckout } = await import(
      "../../server/lib/sessionPackageFulfillment.js"
    );
    const creditFn = async (payload) => {
      // Prefer Supabase REST so Workers can write without Prisma.
      const existing = payload.stripeCheckoutSessionId
        ? await supabaseRest(
            context,
            `session_package_purchases?stripe_checkout_session_id=eq.${encodeURIComponent(payload.stripeCheckoutSessionId)}&select=id`,
            { method: "GET", prefer: "return=representation" }
          )
        : null;
      if (Array.isArray(existing) && existing.length) return existing[0];

      const inserted = await supabaseRest(context, "session_package_purchases", {
        method: "POST",
        body: {
          student_user_id: payload.studentUserId,
          mentor_user_id: payload.mentorUserId || null,
          bundle_id: payload.bundleId,
          stripe_checkout_session_id: payload.stripeCheckoutSessionId,
          sessions_purchased: payload.sessionsPurchased,
          sessions_remaining: payload.sessionsPurchased,
          status: "active"
        }
      });
      return Array.isArray(inserted) ? inserted[0] : inserted;
    };
    await fulfillFlexibleSessionCheckout(session, creditFn);
    await fulfillEssaySupportCheckout(session, async (payload) => {
      const result = await creditFn(payload);
      const packageKey =
        String(session.metadata?.packageKey || "").trim() ||
        `essay_support_${payload.sessionsPurchased}`;
      try {
        await supabaseRest(context, "review_credit_ledger", {
          method: "POST",
          prefer: "return=minimal,resolution=ignore-duplicates",
          body: {
            student_user_id: payload.studentUserId,
            amount: payload.sessionsPurchased,
            transaction_type: "PURCHASE",
            package_key: packageKey,
            stripe_checkout_session_id: payload.stripeCheckoutSessionId,
            idempotency_key: `purchase:${payload.stripeCheckoutSessionId}`,
            reason: "Essay Support purchase",
            created_by_user_id: session.metadata?.purchaserUserId || session.metadata?.userId || null
          }
        });
      } catch (ledgerError) {
        console.error("[stripe-billing] review credit ledger write failed", ledgerError?.message || ledgerError);
      }
      return result;
    });

    const userId = session.metadata?.userId || session.client_reference_id;
    const subscriptionId = stripeObjectId(session.subscription);
    const planId = session.metadata?.planId;
    if (userId && subscriptionId && planId && PURCHASABLE_PLAN_IDS.includes(planId)) {
      try {
        const metaParams = new URLSearchParams();
        metaParams.set("metadata[userId]", userId);
        metaParams.set("metadata[planId]", planId);
        metaParams.set(
          "metadata[checkoutContext]",
          session.metadata?.checkoutContext || "onboarding"
        );
        await stripeRequest(
          context,
          "POST",
          `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
          metaParams
        );
      } catch (metaError) {
        console.error("[stripe-billing] subscription metadata stamp failed", metaError?.message || metaError);
      }
    }
  }

  const invoiceSubscriptionId = stripeObjectId(object.subscription) ||
    stripeObjectId(object.parent?.subscription_details?.subscription);
  if (["invoice.paid", "invoice.payment_succeeded"].includes(event.type) && invoiceSubscriptionId) {
    const subscriptionId = invoiceSubscriptionId;
    if (subscriptionId) {
      const subscription = await stripeRequest(context, "GET", `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
      await syncSubscription(context, subscription, { paymentConfirmed: true });
      const userId = subscription.metadata?.userId;
      const planId =
        (PAID_PLAN_IDS.includes(subscription.metadata?.planId) && subscription.metadata.planId) ||
        (subscription.items?.data || [])
          .map((item) => planIdForPriceId(stripeObjectId(item.price), getBillingConfig(context)))
          .find(Boolean);
      if (userId && planId && ["plus", "pro"].includes(String(planId).toLowerCase())) {
        try {
          const billingReason = String(object.billing_reason || "").toLowerCase();
          const amountPaid = Number(object.amount_paid);
          const shouldGrant =
            !billingReason ||
            billingReason === "subscription_create" ||
            billingReason === "subscription_cycle" ||
            (billingReason === "subscription_update" && amountPaid > 0);
          const zeroCycle = amountPaid === 0 && billingReason === "subscription_cycle";
          if (shouldGrant && !zeroCycle) {
            const periodStart =
              object.lines?.data?.[0]?.period?.start || subscription.current_period_start;
            const periodEnd =
              object.lines?.data?.[0]?.period?.end || subscription.current_period_end;
            if (periodStart && periodEnd && object.id) {
              const startIso = new Date(periodStart * 1000).toISOString();
              const endIso = new Date(periodEnd * 1000).toISOString();
              const allowance = String(planId).toLowerCase() === "pro" ? 4 : 2;
              const idempotencyKey = `session-period:invoice:${object.id}`;
              // Supersede prior active periods for this student.
              await supabaseRest(
                context,
                `subscription_session_periods?student_user_id=eq.${encodeURIComponent(userId)}&status=eq.active`,
                {
                  method: "PATCH",
                  prefer: "return=minimal",
                  body: { status: "superseded", updated_at: new Date().toISOString() }
                }
              );
              await supabaseRest(context, "subscription_session_periods", {
                method: "POST",
                prefer: "return=minimal,resolution=ignore-duplicates",
                body: {
                  student_user_id: userId,
                  plan_id: String(planId).toLowerCase(),
                  allowance,
                  remaining: allowance,
                  status: "active",
                  period_start: startIso,
                  period_end: endIso,
                  stripe_subscription_id: subscription.id,
                  stripe_invoice_id: object.id,
                  stripe_event_id: event.id,
                  idempotency_key: idempotencyKey
                }
              });
            }
          }
        } catch (creditError) {
          console.error("[stripe-billing] session credit grant failed", creditError?.message || creditError);
        }
      }
      const paymentId = stripeObjectId(object.payment_intent) || object.id;
      if (userId && paymentId) {
        const helpers = await confirmReferralPayment(context, {
          userId,
          subscriptionId,
          paymentId,
          invoiceId: object.id
        });
        if (
          helpers?.markRewardApplied &&
          subscription.metadata?.preludeReferralReward === "true" &&
          subscription.metadata?.referralRewardId
        ) {
          await helpers.markRewardApplied({
            rewardId: subscription.metadata.referralRewardId,
            invoiceId: object.id
          });
        }
      }
    }
  }

  if (event.type === "invoice.payment_failed" && invoiceSubscriptionId) {
    const subscriptionId = invoiceSubscriptionId;
    if (subscriptionId) {
      const subscription = await stripeRequest(context, "GET", `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
      await syncSubscription(context, subscription);
    }
  }

  if (["charge.refunded", "charge.dispute.created", "invoice.voided"].includes(event.type)) {
    const paymentId = stripeObjectId(object.payment_intent) || object.id;
    try {
      await revokeReferralRewards(context, paymentId, event.type);
    } catch (error) {
      console.error("[prelude-referral] cf revoke failed", error?.message || error);
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
    paidPlans: PURCHASABLE_PLAN_IDS
  });
}

export async function handleBillingCheckout(context) {
  const config = getBillingConfig(context);
  if (!config.enabled) return json(billingNotConfiguredPayload(config), 503);

  const payload = await readJson(context.request);
  const planId = String(payload.planId || "").toLowerCase();
  const checkoutContext = payload.context === "onboarding" ? "onboarding" : "public";
  if (!PURCHASABLE_PLAN_IDS.includes(planId)) {
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

  if (authUser && planId === "plus") {
    try {
      const rows = await supabaseRest(
        context,
        `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=plan_id,subscription_status,subscription_cancel_at_period_end,subscription_current_period_end,entitlement_ends_at&limit=1`,
        { method: "GET", prefer: "return=representation" }
      );
      const profile = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (
        profile &&
        hasActiveProEntitlement({
          planId: profile.plan_id,
          subscriptionStatus: profile.subscription_status,
          cancelAtPeriodEnd: Boolean(profile.subscription_cancel_at_period_end),
          currentPeriodEnd: profile.subscription_current_period_end,
          entitlementEndsAt: profile.entitlement_ends_at
        })
      ) {
        return json(
          {
            error: "downgrade_not_allowed",
            message: PLUS_BLOCKED_BY_PRO_MESSAGE
          },
          409
        );
      }
    } catch (error) {
      console.error("[stripe-billing] plus checkout entitlement check failed", error?.message || error);
    }
  }

  const priceId = config.prices[planId];
  const priceMatches = await configuredPriceMatches(context, {
    priceId,
    expectedCents: PLAN_PRICE_CENTS[planId],
    recurring: true,
    offeringId: planId
  });
  if (!priceMatches) {
    return json({
      error: "billing_price_mismatch",
      message: `Checkout for ${planId} is unavailable because its Stripe Price does not match the published catalog.`
    }, 503);
  }

  const baseUrl = appBaseUrl(context);
  const { successUrl, cancelUrl } = checkoutResultUrls(baseUrl, planId, checkoutContext);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("line_items[0][price]", priceId);
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

    const pendingReferral = await loadPendingReferral(context, authUser.id);
    if (pendingReferral?.id) {
      const couponId = await resolveReferralCouponId(context);
      if (couponId) {
        params.set("discounts[0][coupon]", couponId);
        params.set("metadata[referralId]", pendingReferral.id);
        params.set("subscription_data[metadata][referralId]", pendingReferral.id);
      }
    }
  } else {
    params.set("metadata[checkoutMode]", "cloudflare_guest");
    params.set("subscription_data[metadata][checkoutMode]", "cloudflare_guest");
  }

  const session = await stripeRequest(context, "POST", "/v1/checkout/sessions", params);
  return json({ url: session.url });
}

export async function handleBillingBundleCheckout(context) {
  const config = getBillingConfig(context);
  if (!config.enabled) return json(billingNotConfiguredPayload(config), 503);

  const { quoteBundleSelection, serializeBundleMetadata } = await import("../../shared/supportBundles.js");
  const payload = await readJson(context.request);
  const checkoutContext = payload.context === "onboarding" ? "onboarding" : "public";

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

  const quote = quoteBundleSelection(payload);
  if (!quote.ok) {
    return json({ error: quote.error || "validation_error", message: quote.message }, 400);
  }
  if (!quote.totalCents || quote.totalCents < 50) {
    return json({ error: "invalid_amount", message: "That bundle total is too low to checkout." }, 400);
  }
  const quantity = Object.values(quote.selection.quantities)[0];
  const priceId = config.bundlePrices?.[quote.selection.bundleId]?.[quantity];
  const priceMatches = await configuredPriceMatches(context, {
    priceId,
    expectedCents: quote.totalCents,
    recurring: false,
    offeringId: quote.selection.bundleId
  });
  if (!priceMatches) {
    return json({
      error: "billing_price_mismatch",
      message: `Checkout for ${quote.selection.bundleId} is unavailable because its Stripe Price does not match the published catalog.`
    }, 503);
  }

  const baseUrl = appBaseUrl(context);
  const purchaseKey = `bundle_${quote.selection.bundleId}`;
  const { successUrl, cancelUrl } = checkoutResultUrls(baseUrl, purchaseKey, checkoutContext);
  const metadata = serializeBundleMetadata(quote);
  if (payload.mentorUserId) metadata.mentorUserId = String(payload.mentorUserId);
  if (payload.mentorId) metadata.mentorId = String(payload.mentorId);

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");

  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, String(value));
  }
  params.set("metadata[checkoutContext]", checkoutContext);

  if (authUser) {
    params.set("client_reference_id", authUser.id);
    params.set("metadata[userId]", authUser.id);
    params.set("customer_email", authUser.email || "");
  } else {
    params.set("metadata[checkoutMode]", "cloudflare_guest");
  }

  const session = await stripeRequest(context, "POST", "/v1/checkout/sessions", params);
  return json({ url: session.url, totalCents: quote.totalCents, bundleId: quote.selection.bundleId });
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

  const sessionRaw = await stripeRequest(
    context,
    "GET",
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`
  );
  const session = enrichCheckoutSessionFromPaymentLink(sessionRaw);

  const sessionUserId = session.metadata?.userId || session.client_reference_id;
  if (!sessionUserId || sessionUserId !== authResult.user.id) {
    return json({ error: "forbidden", message: "That checkout session does not belong to this account." }, 403);
  }

  if (!isCheckoutPaymentSuccessful(session)) {
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
  return json(
    {
      error: "use_billing_membership_portal",
      message: "Use POST /api/billing/portal."
    },
    500
  );
}

export async function handleBillingWebhook(context) {
  const config = getBillingConfig(context);
  if (!config.webhookEnabled) return json(billingNotConfiguredPayload(config), 503);

  const rawBody = await context.request.text();
  const signature = context.request.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "missing_signature", message: "Stripe-Signature header is required." }, 400);
  }
  const verified = await verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret);
  if (!verified) {
    return json({ error: "invalid_signature", message: "Stripe webhook signature verification failed." }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_payload", message: "Webhook body must be valid JSON." }, 400);
  }

  const claimed = await claimBillingWebhookEvent(context, event.id, event.type, {
    type: event.type,
    created: event.created || null
  });
  if (!claimed) {
    return json({ received: true, duplicate: true });
  }

  try {
    await processWebhookEvent(context, event);
  } catch (error) {
    // Allow Stripe retries — do not leave a completed claim if processing failed.
    try {
      await supabaseRest(context, `billing_webhook_events?id=eq.${encodeURIComponent(event.id)}`, {
        method: "DELETE",
        prefer: "return=minimal"
      });
    } catch {
      /* ignore cleanup failure */
    }
    console.error("[stripe-billing] webhook_processing_failed", {
      eventId: event.id,
      eventType: event.type,
      category: error?.code || error?.status || "processing_error"
    });
    return json({ error: "processing_failed", message: "Webhook accepted but processing failed." }, 500);
  }

  return json({ received: true });
}
