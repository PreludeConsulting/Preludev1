/**
 * Household-scoped billing membership: summary, cancel/reactivate, purchase history.
 * Stripe is the payment provider; profiles + billing_purchases are the app source of truth.
 */
import {
  canCancelMembership,
  canPurchaseMembership,
  canReactivateMembership,
  deriveMembershipStatus,
  formatMoneyCents,
  logBillingEvent,
  membershipAccessExplanation
} from "../../shared/billingMembership.js";
import { PLAN_PRICE_CENTS } from "../../shared/billingCatalog.js";
import { evaluateMentorAccess, sumPackageRemaining } from "../../shared/mentorAccess.js";
import { ensureHouseholdForUser } from "./referralCodes.js";
import { listSessionPackagesForStudent } from "./mentorAccess.js";
import { getSupabaseAdmin } from "./supabaseRequestAuth.js";

function admin() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const error = new Error("Supabase admin client is not configured.");
    error.statusCode = 503;
    error.code = "server_error";
    throw error;
  }
  return supabase;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "promotional", "checkout_completed"]);

const PLAN_NAMES = Object.freeze({
  basic: "Basic",
  plus: "Plus",
  pro: "Pro"
});

function planDisplayName(planId) {
  const id = String(planId || "basic").toLowerCase();
  return PLAN_NAMES[id] || String(planId || "Plan");
}

/**
 * Resolve shared billing owner (household) and the profile that holds the Stripe subscription.
 */
export async function resolveBillingContext(userId) {
  const supabase = admin();
  const { data: viewer, error } = await supabase
    .from("profiles")
    .select(
      "id, role, full_name, preferred_name, plan_id, household_id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_start, subscription_current_period_end, subscription_cancel_at_period_end, subscription_canceled_at, payment_waived"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!viewer) {
    const err = new Error("Profile not found.");
    err.statusCode = 404;
    err.code = "not_found";
    throw err;
  }

  const role = String(viewer.role || "").toLowerCase();
  if (role !== "student" && role !== "parent") {
    return {
      viewer,
      householdId: null,
      members: [],
      subscriber: null,
      canManage: false,
      eligible: false,
      reason: "role_ineligible"
    };
  }

  const householdId = viewer.household_id || (await ensureHouseholdForUser(userId));
  let members = [];
  if (householdId) {
    const { data: memberRows } = await supabase
      .from("household_members")
      .select("user_id, role")
      .eq("household_id", householdId);
    const ids = (memberRows || []).map((m) => m.user_id);
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, role, full_name, preferred_name, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_start, subscription_current_period_end, subscription_cancel_at_period_end, subscription_canceled_at, payment_waived"
        )
        .in("id", ids);
      members = profiles || [];
    }
  }
  if (!members.length) members = [viewer];

  // Prefer active paid subscription holder; fall back to any stripe subscription; then viewer.
  const ranked = [...members].sort((a, b) => {
    const score = (p) => {
      let s = 0;
      if (ACTIVE_STATUSES.has(String(p.subscription_status || "").toLowerCase())) s += 4;
      if (p.stripe_subscription_id) s += 2;
      if (p.id === userId) s += 1;
      if (String(p.role).toLowerCase() === "student") s += 1;
      return s;
    };
    return score(b) - score(a);
  });
  const subscriber = ranked[0] || viewer;

  return {
    viewer,
    householdId,
    members,
    subscriber,
    canManage: true,
    eligible: true
  };
}

async function collectSessionPackages(members) {
  const packages = [];
  for (const member of members) {
    if (String(member.role || "").toLowerCase() !== "student") continue;
    const rows = await listSessionPackagesForStudent(member.id);
    packages.push(...rows);
  }
  return packages;
}

export async function getBillingSummary(userId) {
  const ctx = await resolveBillingContext(userId);
  if (!ctx.eligible) {
    return { eligible: false, reason: ctx.reason, canManage: false };
  }

  const sub = ctx.subscriber;
  const planId = String(sub.plan_id || "basic").toLowerCase();
  const statusInfo = deriveMembershipStatus({
    planId,
    subscriptionStatus: sub.subscription_status,
    cancelAtPeriodEnd: Boolean(sub.subscription_cancel_at_period_end),
    currentPeriodEnd: sub.subscription_current_period_end
  });

  const packages = await collectSessionPackages(ctx.members);
  const sessionBalance = sumPackageRemaining(packages);
  const access = evaluateMentorAccess({
    user: {
      plan: planId,
      subscriptionStatus: sub.subscription_status
    },
    packages
  });

  const priceCents = PLAN_PRICE_CENTS[planId] ?? null;
  const plan = {
    id: planId,
    name: planDisplayName(planId),
    priceCents,
    priceLabel: priceCents != null ? formatMoneyCents(priceCents) : null,
    interval: "month",
    currency: "usd"
  };

  return {
    eligible: true,
    canManage: ctx.canManage,
    householdId: ctx.householdId,
    viewerRole: String(ctx.viewer.role || "").toLowerCase(),
    subscriberUserId: sub.id,
    plan,
    membership: {
      ...statusInfo,
      subscriptionStatus: sub.subscription_status || null,
      cancelAtPeriodEnd: Boolean(sub.subscription_cancel_at_period_end),
      currentPeriodStart: sub.subscription_current_period_start || null,
      currentPeriodEnd: sub.subscription_current_period_end || null,
      canceledAt: sub.subscription_canceled_at || null,
      stripeSubscriptionId: sub.stripe_subscription_id || null,
      hasCustomer: Boolean(sub.stripe_customer_id || ctx.viewer.stripe_customer_id),
      explanation: membershipAccessExplanation(statusInfo, { sessionBalance }),
      actions: {
        cancel: canCancelMembership(statusInfo) && ctx.canManage,
        reactivate: canReactivateMembership(statusInfo) && ctx.canManage,
        purchaseMembership: canPurchaseMembership(statusInfo) && ctx.canManage,
        purchaseSessions: ctx.canManage,
        managePaymentMethod: Boolean(sub.stripe_customer_id || ctx.viewer.stripe_customer_id) && ctx.canManage
      }
    },
    sessions: {
      available: sessionBalance,
      packages: packages.map((pkg) => ({
        id: pkg.id,
        bundleId: pkg.bundleId,
        sessionsPurchased: pkg.sessionsPurchased,
        sessionsRemaining: pkg.sessionsRemaining,
        status: pkg.status,
        expiresAt: pkg.expiresAt,
        createdAt: pkg.createdAt
      }))
    },
    mentorAccess: {
      allowed: access.allowed,
      accessType: access.accessType,
      remainingSessions: access.remainingSessions,
      reason: access.reason
    }
  };
}

export async function listBillingPurchases(userId, { limit = 20, offset = 0 } = {}) {
  const ctx = await resolveBillingContext(userId);
  if (!ctx.eligible || !ctx.householdId) {
    return { eligible: false, purchases: [], total: 0 };
  }
  const supabase = admin();
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const from = Math.max(0, Number(offset) || 0);

  const { data, error, count } = await supabase
    .from("billing_purchases")
    .select("*", { count: "exact" })
    .eq("billing_owner_id", ctx.householdId)
    .order("purchased_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  return {
    eligible: true,
    purchases: (data || []).map(mapPurchaseRow),
    total: count ?? (data || []).length,
    limit: pageSize,
    offset: from,
    hasMore: from + pageSize < (count ?? 0)
  };
}

function mapPurchaseRow(row) {
  return {
    id: row.id,
    purchaseType: row.purchase_type,
    displayName: row.display_name,
    planId: row.plan_id,
    productId: row.product_id,
    quantity: row.quantity,
    sessionsPurchased: row.sessions_purchased,
    amountCents: row.amount_cents,
    amountLabel: formatMoneyCents(row.amount_cents, row.currency),
    currency: row.currency,
    paymentStatus: row.payment_status,
    purchasedAt: row.purchased_at,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    receiptUrl: row.receipt_url,
    invoicePdfUrl: row.invoice_pdf_url,
    stripeInvoiceId: row.stripe_invoice_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    refundedAmountCents: row.refunded_amount_cents
  };
}

/**
 * Idempotent purchase insert. Returns existing row on conflict.
 */
export async function recordBillingPurchase(input) {
  const supabase = admin();
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!idempotencyKey) return null;

  const row = {
    billing_owner_id: input.billingOwnerId,
    initiated_by_user_id: input.initiatedByUserId || null,
    subscriber_user_id: input.subscriberUserId || null,
    purchase_type: input.purchaseType,
    product_id: input.productId || null,
    price_id: input.priceId || null,
    plan_id: input.planId || null,
    display_name: input.displayName,
    quantity: input.quantity ?? 1,
    sessions_purchased: input.sessionsPurchased ?? null,
    amount_cents: input.amountCents ?? 0,
    currency: input.currency || "usd",
    payment_status: input.paymentStatus || "paid",
    stripe_customer_id: input.stripeCustomerId || null,
    stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
    stripe_payment_intent_id: input.stripePaymentIntentId || null,
    stripe_invoice_id: input.stripeInvoiceId || null,
    stripe_subscription_id: input.stripeSubscriptionId || null,
    idempotency_key: idempotencyKey,
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    receipt_url: input.receiptUrl || null,
    invoice_pdf_url: input.invoicePdfUrl || null,
    refunded_amount_cents: input.refundedAmountCents || 0,
    metadata: input.metadata || {},
    purchased_at: input.purchasedAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("billing_purchases")
    .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: false })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("billing_purchases")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      logBillingEvent("purchase_duplicate_prevented", { idempotencyKey });
      return existing;
    }
    throw error;
  }

  logBillingEvent("purchase_recorded", {
    purchaseType: row.purchase_type,
    amountCents: row.amount_cents,
    idempotencyKey
  });
  return data;
}

export async function cancelMembershipAtPeriodEnd(userId, { stripe }) {
  const ctx = await resolveBillingContext(userId);
  if (!ctx.eligible || !ctx.canManage) {
    const err = new Error("You cannot manage billing for this account.");
    err.statusCode = 403;
    err.code = "forbidden";
    throw err;
  }
  const subscriptionId = ctx.subscriber.stripe_subscription_id;
  if (!subscriptionId) {
    const err = new Error("No active subscription was found to cancel.");
    err.statusCode = 400;
    err.code = "subscription_missing";
    throw err;
  }

  const statusInfo = deriveMembershipStatus({
    planId: ctx.subscriber.plan_id,
    subscriptionStatus: ctx.subscriber.subscription_status,
    cancelAtPeriodEnd: Boolean(ctx.subscriber.subscription_cancel_at_period_end),
    currentPeriodEnd: ctx.subscriber.subscription_current_period_end
  });
  if (statusInfo.key === "cancels_at_period_end") {
    return {
      ok: true,
      duplicate: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: ctx.subscriber.subscription_current_period_end,
      message: `Your membership is already set to end on ${statusInfo.label.replace(/^Cancels on /, "")}.`
    };
  }
  if (!canCancelMembership(statusInfo)) {
    const err = new Error("This membership cannot be canceled in its current state.");
    err.statusCode = 409;
    err.code = "cancel_not_allowed";
    throw err;
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true
  });

  await persistSubscriptionFields(ctx.subscriber.id, subscription);
  logBillingEvent("cancellation_scheduled", {
    userId,
    subscriberUserId: ctx.subscriber.id,
    subscriptionId,
    currentPeriodEnd: subscription.current_period_end
  });

  const periodEndIso = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  return {
    ok: true,
    duplicate: false,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: periodEndIso,
    message: periodEndIso
      ? `Your membership will remain active until ${periodEndIso}. You will not be charged again unless you renew.`
      : "Automatic renewal has been turned off."
  };
}

export async function reactivateMembershipRenewal(userId, { stripe }) {
  const ctx = await resolveBillingContext(userId);
  if (!ctx.eligible || !ctx.canManage) {
    const err = new Error("You cannot manage billing for this account.");
    err.statusCode = 403;
    err.code = "forbidden";
    throw err;
  }
  const subscriptionId = ctx.subscriber.stripe_subscription_id;
  if (!subscriptionId) {
    const err = new Error("No subscription was found to reactivate.");
    err.statusCode = 400;
    err.code = "subscription_missing";
    throw err;
  }

  const statusInfo = deriveMembershipStatus({
    planId: ctx.subscriber.plan_id,
    subscriptionStatus: ctx.subscriber.subscription_status,
    cancelAtPeriodEnd: Boolean(ctx.subscriber.subscription_cancel_at_period_end),
    currentPeriodEnd: ctx.subscriber.subscription_current_period_end
  });
  if (!canReactivateMembership(statusInfo) && !ctx.subscriber.subscription_cancel_at_period_end) {
    const err = new Error("This membership is not scheduled for cancellation.");
    err.statusCode = 409;
    err.code = "reactivate_not_allowed";
    throw err;
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false
  });
  await persistSubscriptionFields(ctx.subscriber.id, subscription);
  logBillingEvent("cancellation_reversed", {
    userId,
    subscriberUserId: ctx.subscriber.id,
    subscriptionId
  });

  const periodEndIso = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  return {
    ok: true,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: periodEndIso,
    message: periodEndIso
      ? `Automatic renewal is on. Your next renewal is ${periodEndIso}.`
      : "Automatic renewal has been restored."
  };
}

export async function persistSubscriptionFields(userId, subscription, planId = null) {
  const supabase = admin();
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const status = subscription.status || null;
  const active = ACTIVE_STATUSES.has(String(status || "").toLowerCase());
  const resolvedPlan =
    planId ||
    subscription.metadata?.planId ||
    null;

  const patch = {
    stripe_subscription_id: subscription.id || null,
    subscription_status: status,
    subscription_current_period_start: periodStart,
    subscription_current_period_end: periodEnd,
    subscription_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    subscription_canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : subscription.cancel_at_period_end
        ? new Date().toISOString()
        : null
  };
  if (typeof subscription.customer === "string") {
    patch.stripe_customer_id = subscription.customer;
  } else if (subscription.customer?.id) {
    patch.stripe_customer_id = subscription.customer.id;
  }
  if (resolvedPlan && active) patch.plan_id = resolvedPlan;
  if (!active && status && ["canceled", "unpaid", "incomplete_expired"].includes(status)) {
    // Keep plan_id for history display; access uses status + period end.
  }

  await supabase.from("profiles").update(patch).eq("id", userId);
  return patch;
}

export async function recordPurchaseFromCheckoutSession(session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId) return null;
  // Subscription purchases are recorded from invoice.paid to avoid double entries.
  if (session.mode === "subscription") return null;

  const ctx = await resolveBillingContext(userId).catch(() => null);
  if (!ctx?.householdId) return null;

  const planId = session.metadata?.planId || null;
  const amountCents = session.amount_total ?? 0;
  let sessionsPurchased = session.metadata?.sessionsPurchased
    ? Number(session.metadata.sessionsPurchased)
    : null;

  if (session.metadata?.bundleConfig && !Number.isFinite(sessionsPurchased)) {
    try {
      const config = JSON.parse(session.metadata.bundleConfig);
      sessionsPurchased = Number(config?.q?.sessions ?? config?.quantities?.sessions);
    } catch {
      sessionsPurchased = null;
    }
  }

  const displayName =
    session.metadata?.bundleId === "flexible_sessions"
      ? `Flexible sessions${sessionsPurchased ? ` (${sessionsPurchased})` : ""}`
      : session.metadata?.bundleId || "Prelude purchase";

  return recordBillingPurchase({
    billingOwnerId: ctx.householdId,
    initiatedByUserId: userId,
    subscriberUserId: ctx.subscriber?.id || userId,
    purchaseType: "session_package",
    planId,
    productId: session.metadata?.bundleId || planId || null,
    displayName,
    quantity: 1,
    sessionsPurchased: Number.isFinite(sessionsPurchased) && sessionsPurchased > 0 ? sessionsPurchased : null,
    amountCents,
    currency: session.currency || "usd",
    paymentStatus: session.payment_status === "paid" ? "paid" : "pending",
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    stripeSubscriptionId:
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
    idempotencyKey: `checkout:${session.id}`,
    purchasedAt: session.created ? new Date(session.created * 1000).toISOString() : undefined,
    metadata: { mode: session.mode || null }
  });
}

export async function recordPurchaseFromInvoice(invoice, subscription = null) {
  const userId = subscription?.metadata?.userId || invoice.metadata?.userId;
  if (!userId) return null;
  const ctx = await resolveBillingContext(userId).catch(() => null);
  if (!ctx?.householdId) return null;

  const planId = subscription?.metadata?.planId || invoice.metadata?.planId || null;
  const billingReason = String(invoice.billing_reason || "");
  const purchaseType =
    billingReason === "subscription_create" ? "subscription" : "subscription_renewal";
  const displayName = planId
    ? `${planDisplayName(planId)} ${purchaseType === "subscription" ? "monthly membership" : "renewal"}`
    : "Subscription payment";

  return recordBillingPurchase({
    billingOwnerId: ctx.householdId,
    initiatedByUserId: userId,
    subscriberUserId: ctx.subscriber?.id || userId,
    purchaseType,
    planId,
    displayName,
    amountCents: invoice.amount_paid ?? invoice.total ?? 0,
    currency: invoice.currency || "usd",
    paymentStatus: invoice.paid ? "paid" : "pending",
    stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId:
      typeof invoice.payment_intent === "string" ? invoice.payment_intent : invoice.payment_intent?.id,
    stripeSubscriptionId: subscription?.id || null,
    idempotencyKey: `invoice:${invoice.id}`,
    periodStart: invoice.lines?.data?.[0]?.period?.start
      ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
      : null,
    periodEnd: invoice.lines?.data?.[0]?.period?.end
      ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
      : null,
    receiptUrl: invoice.hosted_invoice_url || null,
    invoicePdfUrl: invoice.invoice_pdf || null,
    purchasedAt: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : invoice.created
        ? new Date(invoice.created * 1000).toISOString()
        : undefined
  });
}

export async function claimBillingWebhookEvent(eventId, eventType, payload = {}) {
  if (!eventId) return true;
  const supabase = admin();
  const { error } = await supabase.from("billing_webhook_events").insert({
    id: eventId,
    event_type: eventType,
    payload
  });
  if (error) {
    if (error.code === "23505") {
      logBillingEvent("webhook_duplicate_prevented", { eventId, eventType });
      return false;
    }
    // Table may not exist yet in some envs — fall through and process.
    if (/billing_webhook_events/i.test(error.message || "")) return true;
    throw error;
  }
  return true;
}
