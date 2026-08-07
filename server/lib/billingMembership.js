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
  membershipAccessExplanation,
  buildSubscriptionEntitlement,
  hasActiveProEntitlement,
  PLUS_BLOCKED_BY_PRO_MESSAGE
} from "../../shared/billingMembership.js";
import { resolveSubscriptionPlanEntitlement } from "../../shared/billingSubscriptionSync.js";
import {
  resolveSubscriptionPeriodBounds,
  unixToIso
} from "../../shared/stripeSubscriptionPeriod.js";
import { normalizePersistedSubscriptionStatus } from "../../shared/stripeSubscriptionStatus.js";
import { PLAN_PRICE_CENTS } from "../../shared/billingCatalog.js";
import {
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful
} from "../../shared/stripePaymentLinks.js";
import { evaluateMentorAccess, sumPackageRemaining } from "../../shared/mentorAccess.js";
import { ensureHouseholdForUser } from "./referralCodes.js";
import { listSessionPackagesForStudent } from "./mentorAccess.js";
import { getReviewCreditBalance } from "./reviewCredits.js";
import { getSessionCreditSummary } from "./sessionCredits.js";
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

const ACTIVE_STATUSES = new Set(["active", "trialing", "promotional", "checkout_completed", "complete"]);

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
      "id, role, full_name, preferred_name, plan_id, pending_plan_id, household_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_current_period_start, subscription_current_period_end, subscription_cancel_at_period_end, subscription_canceled_at, entitlement_ends_at, payment_waived, promo_access_ends_at"
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
          "id, role, full_name, preferred_name, plan_id, pending_plan_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_current_period_start, subscription_current_period_end, subscription_cancel_at_period_end, subscription_canceled_at, entitlement_ends_at, payment_waived, promo_access_ends_at"
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
  const entitlementEndsAt = sub.entitlement_ends_at || sub.subscription_current_period_end || null;
  const statusInfo = deriveMembershipStatus({
    planId,
    subscriptionStatus: sub.subscription_status,
    cancelAtPeriodEnd: Boolean(sub.subscription_cancel_at_period_end),
    currentPeriodEnd: entitlementEndsAt
  });

  const packages = await collectSessionPackages(ctx.members);
  const sessionBalance = sumPackageRemaining(packages);
  const creditSummary = await getSessionCreditSummary(sub.id);
  const reviewCredits = await getReviewCreditBalance(sub.id);
  const access = evaluateMentorAccess({
    user: {
      plan: planId,
      subscriptionStatus: sub.subscription_status,
      subscriptionCurrentPeriodEnd: entitlementEndsAt,
      entitlementEndsAt,
      promoAccessEndsAt: sub.promo_access_ends_at
    },
    packages,
    sessionCredits: creditSummary
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

  const subscriptionCreditsRemaining = creditSummary.active ? creditSummary.remaining : 0;
  const hasCustomer = Boolean(sub.stripe_customer_id || ctx.viewer.stripe_customer_id);
  const entitlement = buildSubscriptionEntitlement({
    planId,
    pendingPlanId: sub.pending_plan_id || null,
    subscriptionStatus: sub.subscription_status,
    cancelAtPeriodEnd: Boolean(sub.subscription_cancel_at_period_end),
    billingPeriodStart: sub.subscription_current_period_start || null,
    billingPeriodEnd: sub.subscription_current_period_end || null,
    entitlementEndsAt,
    sessionCreditsRemaining: creditSummary.active ? creditSummary.remaining : 0,
    sessionCreditsTotal: creditSummary.active ? creditSummary.allowance : 0,
    essaySupportPurchased: reviewCredits.purchased,
    essaySupportRemaining: reviewCredits.remaining,
    stripeCustomerId: sub.stripe_customer_id || ctx.viewer.stripe_customer_id || null,
    stripeSubscriptionId: sub.stripe_subscription_id || null,
    stripePriceId: sub.stripe_price_id || null
  });

  return {
    eligible: true,
    canManage: ctx.canManage,
    householdId: ctx.householdId,
    viewerRole: String(ctx.viewer.role || "").toLowerCase(),
    subscriberUserId: sub.id,
    plan,
    membership: {
      ...statusInfo,
      accessActive: statusInfo.accessActive,
      subscriptionStatus: sub.subscription_status || null,
      cancelAtPeriodEnd: Boolean(sub.subscription_cancel_at_period_end),
      currentPeriodStart: sub.subscription_current_period_start || null,
      currentPeriodEnd: sub.subscription_current_period_end || null,
      entitlementEndsAt,
      pendingPlanId: sub.pending_plan_id || null,
      canceledAt: sub.subscription_canceled_at || null,
      stripeSubscriptionId: sub.stripe_subscription_id || null,
      hasCustomer,
      explanation: membershipAccessExplanation(statusInfo, {
        sessionBalance,
        subscriptionCreditsRemaining,
        planId
      }),
      actions: {
        cancel: canCancelMembership(statusInfo) && ctx.canManage,
        reactivate: canReactivateMembership(statusInfo) && ctx.canManage,
        purchaseMembership: canPurchaseMembership(statusInfo) && ctx.canManage,
        purchaseSessions: ctx.canManage,
        managePaymentMethod: hasCustomer && ctx.canManage
      }
    },
    subscription: {
      status: sub.subscription_status || null,
      stripeCustomerId: sub.stripe_customer_id || ctx.viewer.stripe_customer_id || null,
      stripeSubscriptionId: sub.stripe_subscription_id || null,
      stripePriceId: sub.stripe_price_id || null,
      currentPeriodStart: sub.subscription_current_period_start || null,
      currentPeriodEnd: sub.subscription_current_period_end || null,
      entitlementEndsAt,
      pendingPlanId: sub.pending_plan_id || null,
      cancelAtPeriodEnd: Boolean(sub.subscription_cancel_at_period_end)
    },
    entitlement,
    essaySupport: {
      remainingCredits: reviewCredits.remaining,
      totalPurchasedCredits: reviewCredits.purchased
    },
    reviewCredits: {
      purchased: reviewCredits.purchased,
      assigned: reviewCredits.assigned,
      remaining: reviewCredits.remaining
    },
    sessions: {
      available: sessionBalance,
      subscriptionCredits: creditSummary,
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
      subscriptionRemaining: access.subscriptionRemaining,
      packageRemaining: access.packageRemaining,
      allowance: access.allowance,
      periodEnd: access.periodEnd,
      sessionCreditBalanceLabel: access.sessionCreditBalanceLabel,
      reason: access.reason
    },
    canOpenCustomerPortal: hasCustomer
  };
}

export async function getMySubscription(userId) {
  const ctx = await resolveBillingContext(userId);
  if (!ctx.eligible) {
    return {
      eligible: false,
      reason: ctx.reason,
      isActive: false,
      activePlan: "NONE",
      activePlanId: "basic"
    };
  }
  const sub = ctx.subscriber;
  const planId = String(sub.plan_id || "basic").toLowerCase();
  const creditSummary = await getSessionCreditSummary(sub.id);
  const reviewCredits = await getReviewCreditBalance(sub.id);
  const entitlement = buildSubscriptionEntitlement({
    planId,
    pendingPlanId: sub.pending_plan_id || null,
    subscriptionStatus: sub.subscription_status,
    cancelAtPeriodEnd: Boolean(sub.subscription_cancel_at_period_end),
    billingPeriodStart: sub.subscription_current_period_start || null,
    billingPeriodEnd: sub.subscription_current_period_end || null,
    entitlementEndsAt: sub.entitlement_ends_at || sub.subscription_current_period_end || null,
    sessionCreditsRemaining: creditSummary.active ? creditSummary.remaining : 0,
    sessionCreditsTotal: creditSummary.active ? creditSummary.allowance : 0,
    essaySupportPurchased: reviewCredits.purchased,
    essaySupportRemaining: reviewCredits.remaining,
    stripeCustomerId: sub.stripe_customer_id || ctx.viewer.stripe_customer_id || null,
    stripeSubscriptionId: sub.stripe_subscription_id || null,
    stripePriceId: sub.stripe_price_id || null
  });
  return {
    eligible: true,
    viewerRole: String(ctx.viewer.role || "").toLowerCase(),
    subscriberUserId: sub.id,
    ...entitlement
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

/**
 * Switch an existing Plus/Pro subscription item to the other plan price.
 * Does not trust browser-supplied Stripe IDs. Prelude plan state updates via webhooks.
 *
 * @param {string} userId
 * @param {string} targetPlanRaw - "plus" | "pro" | "PLUS" | "PRO"
 * @param {{ stripe: import("stripe").default, getPlanPriceId: (planId: string) => string | null }} deps
 */
export async function changeMembershipPlan(userId, targetPlanRaw, { stripe, getPlanPriceId }) {
  const targetPlan = String(targetPlanRaw || "")
    .trim()
    .toLowerCase();
  if (targetPlan !== "plus" && targetPlan !== "pro") {
    const err = new Error("Choose Plus or Pro.");
    err.statusCode = 400;
    err.code = "invalid_plan";
    throw err;
  }

  const targetPriceId = typeof getPlanPriceId === "function" ? getPlanPriceId(targetPlan) : null;
  if (!targetPriceId) {
    const err = new Error("That plan is not configured.");
    err.statusCode = 503;
    err.code = "billing_not_configured";
    throw err;
  }

  const ctx = await resolveBillingContext(userId);
  if (!ctx.eligible || !ctx.canManage) {
    const err = new Error("You cannot manage billing for this account.");
    err.statusCode = 403;
    err.code = "forbidden";
    throw err;
  }

  const subscriber = ctx.subscriber;
  const customerId = subscriber.stripe_customer_id || ctx.viewer.stripe_customer_id || null;
  const subscriptionId = subscriber.stripe_subscription_id || null;
  if (!customerId || !subscriptionId) {
    const err = new Error("No active subscription was found to change. Use checkout to start a plan.");
    err.statusCode = 409;
    err.code = "subscription_missing";
    throw err;
  }

  const currentPlan = String(subscriber.plan_id || "").toLowerCase();
  const statusInfo = deriveMembershipStatus({
    planId: currentPlan,
    subscriptionStatus: subscriber.subscription_status,
    cancelAtPeriodEnd: Boolean(subscriber.subscription_cancel_at_period_end),
    currentPeriodEnd: subscriber.subscription_current_period_end
  });
  if (!statusInfo.accessActive || (currentPlan !== "plus" && currentPlan !== "pro")) {
    const err = new Error("No active subscription was found to change. Use checkout to start a plan.");
    err.statusCode = 409;
    err.code = "subscription_missing";
    throw err;
  }
  if (currentPlan === targetPlan) {
    const err = new Error("You are already on this plan.");
    err.statusCode = 409;
    err.code = "same_plan";
    throw err;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"]
  });
  const subscriptionCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!subscriptionCustomerId || subscriptionCustomerId !== customerId) {
    const err = new Error("We couldn’t change your plan. Your current plan has not been changed.");
    err.statusCode = 403;
    err.code = "subscription_mismatch";
    throw err;
  }

  const items = subscription.items?.data || [];
  const recurringItem =
    items.find((item) => item.price?.type === "recurring" || item.price?.recurring) || items[0];
  if (!recurringItem?.id) {
    const err = new Error("We couldn’t change your plan. Your current plan has not been changed.");
    err.statusCode = 400;
    err.code = "subscription_item_missing";
    throw err;
  }

  const currentPriceId =
    typeof recurringItem.price === "string" ? recurringItem.price : recurringItem.price?.id;
  if (currentPriceId && currentPriceId === targetPriceId) {
    const err = new Error("You are already on this plan.");
    err.statusCode = 409;
    err.code = "same_plan";
    throw err;
  }

  const isUpgrade = currentPlan === "plus" && targetPlan === "pro";
  const isDowngrade = currentPlan === "pro" && targetPlan === "plus";
  if (!isUpgrade && !isDowngrade) {
    const err = new Error("That plan change is not supported.");
    err.statusCode = 400;
    err.code = "invalid_plan_change";
    throw err;
  }

  const periodEndIso = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : subscriber.subscription_current_period_end || null;

  if (isDowngrade) {
    // Schedule Plus for the next billing period. Keep Pro effective until then.
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: recurringItem.id, price: targetPriceId, quantity: 1 }],
      proration_behavior: "none",
      metadata: {
        ...(subscription.metadata || {}),
        planId: "plus",
        userId: subscriber.id,
        previousPlanId: "pro",
        pendingPlanId: "plus",
        pendingUpgrade: "",
        pendingDowngrade: "true",
        deferDowngrade: "true",
        deferUntil: periodEndIso || ""
      }
    });

    const supabase = admin();
    await supabase
      .from("profiles")
      .update({
        plan_id: "pro",
        pending_plan_id: "plus",
        stripe_price_id: targetPriceId,
        entitlement_ends_at: periodEndIso
      })
      .eq("id", subscriber.id);

    logBillingEvent("plan_change_requested", {
      userId,
      subscriberUserId: subscriber.id,
      subscriptionId,
      fromPlan: currentPlan,
      toPlan: targetPlan,
      deferred: true,
      entitlementDeferred: true
    });

    return {
      ok: true,
      processing: true,
      fromPlan: currentPlan,
      targetPlan,
      deferred: true,
      message:
        "Plus is scheduled for the end of your current Pro billing period. You keep Pro access until then."
    };
  }

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: recurringItem.id, price: targetPriceId, quantity: 1 }],
    proration_behavior: "create_prorations",
    metadata: {
      ...(subscription.metadata || {}),
      planId: targetPlan,
      userId: subscriber.id,
      previousPlanId: currentPlan,
      pendingPlanId: targetPlan,
      pendingUpgrade: "true",
      pendingDowngrade: "",
      deferDowngrade: "",
      deferUntil: ""
    }
  });

  // Keep Plus until Stripe confirms the paid upgrade via webhook.
  const supabase = admin();
  await supabase
    .from("profiles")
    .update({
      plan_id: currentPlan,
      pending_plan_id: targetPlan,
      stripe_price_id: targetPriceId,
      entitlement_ends_at: periodEndIso
    })
    .eq("id", subscriber.id);

  logBillingEvent("plan_change_requested", {
    userId,
    subscriberUserId: subscriber.id,
    subscriptionId,
    fromPlan: currentPlan,
    toPlan: targetPlan,
    deferred: false,
    entitlementDeferred: true
  });

  return {
    ok: true,
    processing: true,
    fromPlan: currentPlan,
    targetPlan,
    deferred: false,
    message: "Upgrade requested. Your Prelude plan switches to Pro after Stripe confirms payment."
  };
}

export async function syncSubscriptionFromStripe(userId, { stripe } = {}) {
  if (!userId || !stripe) {
    const err = new Error("Stripe sync is unavailable.");
    err.statusCode = 503;
    err.code = "billing_not_configured";
    throw err;
  }
  const ctx = await resolveBillingContext(userId);
  if (!ctx.eligible) {
    const err = new Error("Billing is not available for this account.");
    err.statusCode = 403;
    err.code = "forbidden";
    throw err;
  }
  const subscriptionId = ctx.subscriber?.stripe_subscription_id || null;
  if (!subscriptionId) {
    return { ok: true, synced: false, reason: "no_subscription" };
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price", "latest_invoice"]
  });
  const { syncSupabaseSubscription } = await import("./supabaseBillingSync.js");
  await syncSupabaseSubscription(subscription, null, { paymentConfirmed: false });
  return { ok: true, synced: true, subscriptionId };
}

export async function persistSubscriptionFields(userId, subscription, planId = null, extras = {}) {
  const supabase = admin();
  const bounds = resolveSubscriptionPeriodBounds(subscription);
  const periodEnd = unixToIso(bounds.endUnix);
  const periodStart = unixToIso(bounds.startUnix);
  const status = subscription.status || null;
  const normalizedStatus =
    normalizePersistedSubscriptionStatus(status, {
      paymentSuccessful: Boolean(extras.paymentConfirmed)
    }) || status;
  const active = ACTIVE_STATUSES.has(String(normalizedStatus || "").toLowerCase());
  const resolvedPlan =
    planId ||
    subscription.metadata?.planId ||
    null;

  const items = subscription.items?.data || [];
  const recurring = items.find((item) => item.price?.type === "recurring" || item.price?.recurring) || items[0];
  const priceId =
    typeof recurring?.price === "string" ? recurring.price : recurring?.price?.id || null;

  const entitlement = resolveSubscriptionPlanEntitlement({
    priorPlanId: extras.priorPlanId || null,
    mappedPlanId: resolvedPlan,
    paymentConfirmed: Boolean(extras.paymentConfirmed),
    metadata: subscription.metadata,
    subscriptionStatus: status,
    currentPeriodEnd: periodEnd
  });

  // Prefer the caller-resolved plan (already gated for unpaid upgrades), then entitlement.
  let activePlanId = active
    ? (planId != null && planId !== entitlement.activePlanId && entitlement.scheduledPlanId
        ? entitlement.activePlanId
        : planId != null
          ? (entitlement.activePlanId || planId)
          : entitlement.activePlanId)
    : null;
  // When entitlement keeps Pro during a scheduled Plus downgrade, always honor that.
  if (active && entitlement.activePlanId) {
    activePlanId = entitlement.activePlanId;
  }
  let pendingPlanId = active
    ? (extras.pendingPlanId !== undefined
        ? extras.pendingPlanId
        : entitlement.pendingPlanId || entitlement.scheduledPlanId)
    : extras.pendingPlanId === "pro" || extras.pendingPlanId === "plus"
      ? extras.pendingPlanId
      : null;

  // Canceled / unpaid but still within the paid window — keep effective membership.
  if (
    !active &&
    extras.priorPlanId &&
    ["plus", "pro"].includes(String(extras.priorPlanId).toLowerCase()) &&
    periodEnd &&
    new Date(periodEnd).getTime() > Date.now() &&
    ["canceled", "cancelled", "unpaid"].includes(String(status || "").toLowerCase())
  ) {
    activePlanId = String(extras.priorPlanId).toLowerCase();
    if (entitlement.scheduledPlanId === "plus" || entitlement.pendingPlanId === "plus") {
      pendingPlanId = "plus";
    }
  }

  const patch = {
    stripe_subscription_id: subscription.id || null,
    subscription_status: normalizedStatus,
    subscription_current_period_start: periodStart,
    subscription_current_period_end: periodEnd,
    subscription_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    subscription_canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : subscription.cancel_at_period_end
        ? new Date().toISOString()
        : null,
    entitlement_ends_at: periodEnd,
    ...(priceId ? { stripe_price_id: priceId } : {}),
    pending_plan_id: pendingPlanId
  };
  if (typeof subscription.customer === "string") {
    patch.stripe_customer_id = subscription.customer;
  } else if (subscription.customer?.id) {
    patch.stripe_customer_id = subscription.customer.id;
  }
  if (activePlanId && (active || (periodEnd && new Date(periodEnd).getTime() > Date.now()))) {
    patch.plan_id = activePlanId;
  }
  if (!active && status && ["canceled", "unpaid", "incomplete_expired"].includes(status)) {
    if (periodEnd && new Date(periodEnd).getTime() <= Date.now()) {
      patch.plan_id = "basic";
      patch.pending_plan_id = null;
    }
  }

  await supabase.from("profiles").update(patch).eq("id", userId);
  return patch;
}

export async function recordPurchaseFromCheckoutSession(session) {
  const enriched = enrichCheckoutSessionFromPaymentLink(session);
  const userId = enriched.metadata?.userId || enriched.client_reference_id;
  if (!userId) return null;
  // Subscription purchases are recorded from invoice.paid to avoid double entries.
  if (enriched.mode === "subscription") return null;

  const ctx = await resolveBillingContext(userId).catch(() => null);
  if (!ctx?.householdId) return null;

  const planId = enriched.metadata?.planId || null;
  const amountCents = enriched.amount_total ?? 0;
  const bundleId = String(enriched.metadata?.bundleId || "").trim();
  let sessionsPurchased = enriched.metadata?.sessionsPurchased
    ? Number(enriched.metadata.sessionsPurchased)
    : null;

  if (enriched.metadata?.bundleConfig && !Number.isFinite(sessionsPurchased)) {
    try {
      const config = JSON.parse(enriched.metadata.bundleConfig);
      const quantities = config?.q || config?.quantities || {};
      if (bundleId === "essay_support") {
        sessionsPurchased = Number(quantities.essayReviews);
      } else {
        sessionsPurchased = Number(quantities.sessions);
      }
    } catch {
      sessionsPurchased = null;
    }
  }

  if (
    bundleId === "essay_support" &&
    !Number.isFinite(sessionsPurchased) &&
    enriched.metadata?.essayReviews
  ) {
    sessionsPurchased = Number(enriched.metadata.essayReviews);
  }

  if (
    bundleId === "essay_support" &&
    enriched.metadata?.creditQuantity &&
    Number.isFinite(Number(enriched.metadata.creditQuantity))
  ) {
    sessionsPurchased = Number(enriched.metadata.creditQuantity);
  }

  const qty =
    Number.isFinite(sessionsPurchased) && sessionsPurchased > 0 ? sessionsPurchased : null;

  let displayName = enriched.metadata?.bundleId || "Prelude purchase";
  if (bundleId === "flexible_sessions") {
    displayName = `Flexible sessions${qty ? ` (${qty})` : ""}`;
  } else if (bundleId === "essay_support") {
    displayName = `Essay Support${qty ? ` (${qty} credits)` : ""}`;
  }

  return recordBillingPurchase({
    billingOwnerId: ctx.householdId,
    initiatedByUserId: userId,
    subscriberUserId: ctx.subscriber?.id || userId,
    purchaseType: "session_package",
    planId,
    productId: enriched.metadata?.bundleId || planId || null,
    displayName,
    quantity: 1,
    sessionsPurchased: qty,
    amountCents,
    currency: enriched.currency || "usd",
    paymentStatus: isCheckoutPaymentSuccessful(enriched) ? "paid" : "pending",
    stripeCustomerId: typeof enriched.customer === "string" ? enriched.customer : enriched.customer?.id,
    stripeCheckoutSessionId: enriched.id,
    stripePaymentIntentId:
      typeof enriched.payment_intent === "string" ? enriched.payment_intent : enriched.payment_intent?.id,
    stripeSubscriptionId:
      typeof enriched.subscription === "string" ? enriched.subscription : enriched.subscription?.id,
    idempotencyKey: `checkout:${enriched.id}`,
    purchasedAt: enriched.created ? new Date(enriched.created * 1000).toISOString() : undefined,
    metadata: { mode: enriched.mode || null }
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
