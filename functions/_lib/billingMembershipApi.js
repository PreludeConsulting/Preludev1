/**
 * Cloudflare Pages Functions — billing membership (summary/history/cancel/reactivate/portal).
 * Fetch-native + Supabase REST. Does not use Prisma or Node filesystem stores.
 */
import {
  canCancelMembership,
  canPurchaseMembership,
  canReactivateMembership,
  deriveMembershipStatus,
  formatMoneyCents,
  membershipAccessExplanation,
  buildSubscriptionEntitlement,
  hasActiveProEntitlement,
  PLUS_BLOCKED_BY_PRO_MESSAGE
} from "../../shared/billingMembership.js";
import { PLAN_PRICE_CENTS } from "../../shared/billingCatalog.js";
import { evaluateMentorAccess, sumPackageRemaining } from "../../shared/mentorAccess.js";
import { adminRest, first, httpError, json, requireUser, runtimeFetch } from "./http.js";

const STRIPE_API_VERSION = "2026-05-27.dahlia";
const ACTIVE_STATUSES = new Set(["active", "trialing", "promotional", "checkout_completed"]);
const PLAN_NAMES = Object.freeze({ basic: "Basic", plus: "Plus", pro: "Pro" });

function getEnv(context, name) {
  return context.env?.[name] || "";
}

function getBillingConfig(context) {
  const provider = (getEnv(context, "BILLING_PROVIDER") || "disabled").toLowerCase();
  const stripeSecretKey = getEnv(context, "STRIPE_SECRET_KEY").trim();
  const prices = {
    plus: getEnv(context, "STRIPE_PRICE_ID_PLUS") || getEnv(context, "STRIPE_PRICE_PLUS_MONTHLY"),
    pro: getEnv(context, "STRIPE_PRICE_ID_PRO") || getEnv(context, "STRIPE_PRICE_PRO_MONTHLY")
  };
  return {
    enabled: provider === "stripe" && Boolean(stripeSecretKey),
    stripeSecretKey,
    prices,
    appBaseUrl: (
      getEnv(context, "PUBLIC_APP_URL") ||
      getEnv(context, "VITE_PUBLIC_APP_URL") ||
      "https://preludeconsultingllc.com"
    ).replace(/\/$/, "")
  };
}

function billingNotConfiguredPayload() {
  return {
    error: "billing_not_configured",
    message: "Billing is not configured for this deployment."
  };
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
  const response = await runtimeFetch(context)(`https://api.stripe.com${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Stripe request failed.");
    error.status = response.status;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function planDisplayName(planId) {
  const id = String(planId || "basic").toLowerCase();
  return PLAN_NAMES[id] || String(planId || "Plan");
}

function mapPackageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    mentorUserId: row.mentor_user_id ?? null,
    bundleId: row.bundle_id || "flexible_sessions",
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    sessionsPurchased: Number(row.sessions_purchased) || 0,
    sessionsRemaining: Number(row.sessions_remaining) || 0,
    status: row.status || "active",
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function sumEssayPackageRemaining(packages = []) {
  return packages.reduce((sum, pkg) => sum + (Number(pkg.sessionsRemaining) || 0), 0);
}

function summarizeReviewCredits(entries = [], packages = []) {
  let purchased = 0;
  let assigned = 0;
  let restored = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    const type = String(entry.transaction_type || entry.transactionType || "").toUpperCase();
    if (type === "PURCHASE" || type === "ADMIN_ADJUSTMENT") {
      if (amount > 0) purchased += amount;
    }
    if (type === "ACTIVITY_ASSIGNED" && amount < 0) assigned += Math.abs(amount);
    if (type === "ACTIVITY_CANCELLED" && amount > 0) restored += amount;
    if (type === "REFUND" && amount < 0) purchased = Math.max(0, purchased + amount);
  }
  const remainingFromLedger = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const remainingFromPackages = sumEssayPackageRemaining(packages);
  const remaining = Math.max(0, Math.max(remainingFromLedger, remainingFromPackages));
  return {
    purchased: Math.max(purchased, remaining + assigned - restored),
    assigned: Math.max(0, assigned - restored),
    remaining
  };
}

function summarizeSessionPeriod(period) {
  if (!period) {
    return { allowance: 0, remaining: 0, used: 0, periodEnd: null, planId: null, active: false, periodId: null };
  }
  const allowance = Math.max(0, Number(period.allowance) || 0);
  const remaining = Math.max(0, Number(period.remaining) || 0);
  return {
    allowance,
    remaining,
    used: Math.max(0, allowance - remaining),
    periodEnd: period.period_end || null,
    planId: period.plan_id || null,
    active: true,
    periodId: period.id
  };
}

async function ensureHousehold(context, userId) {
  try {
    const data = await adminRest(context, "rpc/ensure_household_for_user", {
      method: "POST",
      body: JSON.stringify({ p_user_id: userId })
    });
    return data || null;
  } catch {
    return null;
  }
}

async function resolveBillingContext(context, userId) {
  const viewers = await adminRest(
    context,
    `profiles?id=eq.${encodeURIComponent(userId)}&select=id,role,full_name,preferred_name,plan_id,pending_plan_id,household_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_status,subscription_current_period_start,subscription_current_period_end,subscription_cancel_at_period_end,subscription_canceled_at,entitlement_ends_at,payment_waived,promo_access_ends_at&limit=1`
  );
  const viewer = first(viewers);
  if (!viewer) throw httpError("Profile not found.", 404, "not_found");

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

  let householdId = viewer.household_id || (await ensureHousehold(context, userId));
  let members = [];
  if (householdId) {
    const memberRows = await adminRest(
      context,
      `household_members?household_id=eq.${encodeURIComponent(householdId)}&select=user_id,role`
    );
    const ids = (memberRows || []).map((m) => m.user_id).filter(Boolean);
    if (ids.length) {
      const profiles = await adminRest(
        context,
        `profiles?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,role,full_name,preferred_name,plan_id,pending_plan_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_status,subscription_current_period_start,subscription_current_period_end,subscription_cancel_at_period_end,subscription_canceled_at,entitlement_ends_at,payment_waived,promo_access_ends_at`
      );
      members = profiles || [];
    }
  }
  if (!members.length) members = [viewer];

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

  return {
    viewer,
    householdId,
    members,
    subscriber: ranked[0] || viewer,
    canManage: true,
    eligible: true
  };
}

async function listPackagesForStudent(context, studentUserId) {
  const rows = await adminRest(
    context,
    `session_package_purchases?student_user_id=eq.${encodeURIComponent(studentUserId)}&select=*&order=created_at.asc`
  );
  return (rows || []).map(mapPackageRow);
}

async function collectSessionPackages(context, members) {
  const packages = [];
  for (const member of members) {
    if (String(member.role || "").toLowerCase() !== "student") continue;
    packages.push(...(await listPackagesForStudent(context, member.id)));
  }
  return packages;
}

async function getSessionCreditSummary(context, studentUserId) {
  const nowIso = new Date().toISOString();
  const rows = await adminRest(
    context,
    `subscription_session_periods?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&period_end=gt.${encodeURIComponent(nowIso)}&select=*&order=period_start.desc&limit=1`
  );
  return summarizeSessionPeriod(first(rows));
}

async function getReviewCreditSummary(context, studentUserId) {
  const [entries, packages] = await Promise.all([
    adminRest(
      context,
      `review_credit_ledger?student_user_id=eq.${encodeURIComponent(studentUserId)}&select=*&order=created_at.asc`
    ),
    adminRest(
      context,
      `session_package_purchases?student_user_id=eq.${encodeURIComponent(studentUserId)}&bundle_id=eq.essay_support&select=*&order=created_at.asc`
    )
  ]);
  const mappedPackages = (packages || []).map(mapPackageRow);
  return {
    ...summarizeReviewCredits(entries || [], mappedPackages),
    packages: mappedPackages
  };
}

function errorResponse(error) {
  const status = error.statusCode || error.status || 500;
  return json(
    {
      error:
        status === 401
          ? "Unauthorized"
          : error.code || (status >= 500 ? "server_error" : "request_failed"),
      message: error.message || (status === 401 ? "Unauthorized" : "Request failed.")
    },
    status
  );
}

export async function handleBillingSummary(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "GET") {
      return json({ error: "method_not_allowed", message: "Use GET." }, 405);
    }
    const { user } = await requireUser(context);
    const ctx = await resolveBillingContext(context, user.id);
    if (!ctx.eligible) {
      return json({ eligible: false, reason: ctx.reason, canManage: false });
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

    const packages = await collectSessionPackages(context, ctx.members);
    const sessionBalance = sumPackageRemaining(packages);
    const creditSummary = await getSessionCreditSummary(context, sub.id);
    const reviewCredits = await getReviewCreditSummary(context, sub.id);
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
    const subscriptionCreditsRemaining = creditSummary.active ? creditSummary.remaining : 0;
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

    return json({
      eligible: true,
      canManage: ctx.canManage,
      householdId: ctx.householdId,
      viewerRole: String(ctx.viewer.role || "").toLowerCase(),
      subscriberUserId: sub.id,
      plan: {
        id: planId,
        name: planDisplayName(planId),
        priceCents,
        priceLabel: priceCents != null ? formatMoneyCents(priceCents) : null,
        interval: "month",
        currency: "usd"
      },
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
        hasCustomer: Boolean(sub.stripe_customer_id || ctx.viewer.stripe_customer_id),
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
          managePaymentMethod:
            Boolean(sub.stripe_customer_id || ctx.viewer.stripe_customer_id) && ctx.canManage
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
      canOpenCustomerPortal: Boolean(sub.stripe_customer_id || ctx.viewer.stripe_customer_id)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleMySubscription(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "GET") {
      return json({ error: "method_not_allowed", message: "Use GET." }, 405);
    }
    const { user } = await requireUser(context);
    const ctx = await resolveBillingContext(context, user.id);
    if (!ctx.eligible) {
      return json({
        eligible: false,
        reason: ctx.reason,
        isActive: false,
        activePlan: "NONE",
        activePlanId: "basic"
      });
    }
    const sub = ctx.subscriber;
    const planId = String(sub.plan_id || "basic").toLowerCase();
    const creditSummary = await getSessionCreditSummary(context, sub.id);
    const reviewCredits = await getReviewCreditSummary(context, sub.id);
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
    return json({
      eligible: true,
      viewerRole: String(ctx.viewer.role || "").toLowerCase(),
      subscriberUserId: sub.id,
      ...entitlement
    });
  } catch (error) {
    return errorResponse(error);
  }
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
    stripeCheckoutSessionId: row.stripe_checkout_session_id
  };
}

export async function handleBillingHistory(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "GET") {
      return json({ error: "method_not_allowed", message: "Use GET." }, 405);
    }
    const { user } = await requireUser(context);
    const url = new URL(context.request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

    const ctx = await resolveBillingContext(context, user.id);
    if (!ctx.eligible || !ctx.householdId) {
      return json({ eligible: false, purchases: [], total: 0, hasMore: false, limit, offset });
    }

    const rows = await adminRest(
      context,
      `billing_purchases?billing_owner_id=eq.${encodeURIComponent(ctx.householdId)}&select=*&order=purchased_at.desc&limit=${limit}&offset=${offset}`
    );
    const countRows = await adminRest(
      context,
      `billing_purchases?billing_owner_id=eq.${encodeURIComponent(ctx.householdId)}&select=id`
    );
    const total = Array.isArray(countRows) ? countRows.length : (rows || []).length;

    return json({
      eligible: true,
      purchases: (rows || []).map(mapPurchaseRow),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      purchaseHistory: (rows || []).map(mapPurchaseRow)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function persistSubscriptionPatch(context, userId, subscription) {
  const patch = {
    stripe_subscription_id: subscription.id || null,
    subscription_status: subscription.status || null,
    subscription_current_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    subscription_current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    subscription_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    subscription_canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : subscription.cancel_at_period_end
        ? new Date().toISOString()
        : null
  };
  if (typeof subscription.customer === "string") patch.stripe_customer_id = subscription.customer;
  await adminRest(context, `profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: { Prefer: "return=minimal" }
  });
}

export async function handleBillingCancel(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }
    const config = getBillingConfig(context);
    if (!config.enabled) return json(billingNotConfiguredPayload(), 503);

    const { user } = await requireUser(context);
    const ctx = await resolveBillingContext(context, user.id);
    if (!ctx.eligible || !ctx.canManage) throw httpError("You cannot manage billing for this account.", 403, "forbidden");

    const subscriptionId = ctx.subscriber.stripe_subscription_id;
    if (!subscriptionId) throw httpError("No active subscription was found to cancel.", 400, "subscription_missing");

    const statusInfo = deriveMembershipStatus({
      planId: ctx.subscriber.plan_id,
      subscriptionStatus: ctx.subscriber.subscription_status,
      cancelAtPeriodEnd: Boolean(ctx.subscriber.subscription_cancel_at_period_end),
      currentPeriodEnd: ctx.subscriber.subscription_current_period_end
    });
    if (statusInfo.key === "cancels_at_period_end") {
      return json({
        ok: true,
        duplicate: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: ctx.subscriber.subscription_current_period_end,
        message: `Your membership is already set to end on ${statusInfo.label.replace(/^Cancels on /, "")}.`
      });
    }
    if (!canCancelMembership(statusInfo)) {
      throw httpError("This membership cannot be canceled in its current state.", 409, "cancel_not_allowed");
    }

    const params = new URLSearchParams();
    params.set("cancel_at_period_end", "true");
    const subscription = await stripeRequest(
      context,
      "POST",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      params
    );
    await persistSubscriptionPatch(context, ctx.subscriber.id, subscription);
    const periodEndIso = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    return json({
      ok: true,
      duplicate: false,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEndIso,
      message: periodEndIso
        ? `Your membership will remain active until ${periodEndIso}. You will not be charged again unless you renew.`
        : "Automatic renewal has been turned off."
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleBillingReactivate(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }
    const config = getBillingConfig(context);
    if (!config.enabled) return json(billingNotConfiguredPayload(), 503);

    const { user } = await requireUser(context);
    const ctx = await resolveBillingContext(context, user.id);
    if (!ctx.eligible || !ctx.canManage) throw httpError("You cannot manage billing for this account.", 403, "forbidden");

    const subscriptionId = ctx.subscriber.stripe_subscription_id;
    if (!subscriptionId) throw httpError("No subscription was found to reactivate.", 400, "subscription_missing");

    const statusInfo = deriveMembershipStatus({
      planId: ctx.subscriber.plan_id,
      subscriptionStatus: ctx.subscriber.subscription_status,
      cancelAtPeriodEnd: Boolean(ctx.subscriber.subscription_cancel_at_period_end),
      currentPeriodEnd: ctx.subscriber.subscription_current_period_end
    });
    if (!canReactivateMembership(statusInfo) && !ctx.subscriber.subscription_cancel_at_period_end) {
      throw httpError("This membership is not scheduled for cancellation.", 409, "reactivate_not_allowed");
    }

    const params = new URLSearchParams();
    params.set("cancel_at_period_end", "false");
    const subscription = await stripeRequest(
      context,
      "POST",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      params
    );
    await persistSubscriptionPatch(context, ctx.subscriber.id, subscription);
    const periodEndIso = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    return json({
      ok: true,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: periodEndIso,
      message: periodEndIso
        ? `Automatic renewal is on. Your next renewal is ${periodEndIso}.`
        : "Automatic renewal has been restored."
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleBillingPortal(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }
    const config = getBillingConfig(context);
    if (!config.enabled) return json(billingNotConfiguredPayload(), 503);

    const { user } = await requireUser(context);
    const ctx = await resolveBillingContext(context, user.id);
    const customerId =
      ctx.subscriber?.stripe_customer_id || ctx.viewer?.stripe_customer_id || null;
    if (!customerId) {
      return json(
        {
          error: "billing_customer_missing",
          message: "No billing profile exists for this account yet."
        },
        400
      );
    }

    const params = new URLSearchParams();
    params.set("customer", customerId);
    params.set("return_url", `${config.appBaseUrl}/dashboard/student/billing?portal=return`);
    const session = await stripeRequest(context, "POST", "/v1/billing_portal/sessions", params);
    return json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Pull the customer's Stripe subscription and re-run entitlement sync.
 * Used when returning from Customer Portal before the webhook arrives.
 */
export async function handleBillingSyncSubscription(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }
    const config = getBillingConfig(context);
    if (!config.enabled) return json(billingNotConfiguredPayload(), 503);

    const { user } = await requireUser(context);
    const ctx = await resolveBillingContext(context, user.id);
    if (!ctx.eligible) {
      return json({ ok: true, synced: false, reason: ctx.reason || "ineligible" });
    }
    const subscriptionId = ctx.subscriber?.stripe_subscription_id || null;
    if (!subscriptionId) {
      return json({ ok: true, synced: false, reason: "no_subscription" });
    }

    const subscription = await stripeRequest(
      context,
      "GET",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=items.data.price&expand[]=latest_invoice`
    );
    const { syncSubscriptionFromStripeEvent } = await import("./stripeBilling.js");
    if (typeof syncSubscriptionFromStripeEvent === "function") {
      await syncSubscriptionFromStripeEvent(context, subscription);
    }
    return json({ ok: true, synced: true, subscriptionId });
  } catch (error) {
    return errorResponse(error);
  }
}

function configuredPriceId(value) {
  const priceId = String(value || "").trim();
  return /^price_[A-Za-z0-9]+$/.test(priceId) ? priceId : null;
}

export async function handleBillingChangePlan(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    if (context.request.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }
    const config = getBillingConfig(context);
    if (!config.enabled) return json(billingNotConfiguredPayload(), 503);

    const { user } = await requireUser(context);
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      body = {};
    }
    // Only targetPlan is accepted — ignore browser Stripe IDs.
    const targetPlan = String(body?.targetPlan || "")
      .trim()
      .toLowerCase();
    if (targetPlan !== "plus" && targetPlan !== "pro") {
      return json({ error: "invalid_plan", message: "Choose Plus or Pro." }, 400);
    }
    const targetPriceId = configuredPriceId(config.prices?.[targetPlan]);
    if (!targetPriceId) {
      return json(billingNotConfiguredPayload(), 503);
    }

    const ctx = await resolveBillingContext(context, user.id);
    if (!ctx.eligible || !ctx.canManage) {
      throw httpError("You cannot manage billing for this account.", 403, "forbidden");
    }

    const customerId = ctx.subscriber?.stripe_customer_id || ctx.viewer?.stripe_customer_id || null;
    const subscriptionId = ctx.subscriber?.stripe_subscription_id || null;
    if (!customerId || !subscriptionId) {
      return json(
        {
          error: "subscription_missing",
          message: "No active subscription was found to change. Use checkout to start a plan."
        },
        409
      );
    }

    const currentPlan = String(ctx.subscriber.plan_id || "").toLowerCase();
    const statusInfo = deriveMembershipStatus({
      planId: currentPlan,
      subscriptionStatus: ctx.subscriber.subscription_status,
      cancelAtPeriodEnd: Boolean(ctx.subscriber.subscription_cancel_at_period_end),
      currentPeriodEnd: ctx.subscriber.subscription_current_period_end
    });
    if (!statusInfo.accessActive || (currentPlan !== "plus" && currentPlan !== "pro")) {
      return json(
        {
          error: "subscription_missing",
          message: "No active subscription was found to change. Use checkout to start a plan."
        },
        409
      );
    }
    if (currentPlan === targetPlan) {
      return json({ error: "same_plan", message: "You are already on this plan." }, 409);
    }

    const subscription = await stripeRequest(
      context,
      "GET",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=items.data.price`
    );
    const subscriptionCustomerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (!subscriptionCustomerId || subscriptionCustomerId !== customerId) {
      return json(
        {
          error: "subscription_mismatch",
          message: "We couldn’t change your plan. Your current plan has not been changed."
        },
        403
      );
    }

    const items = subscription.items?.data || [];
    const recurringItem =
      items.find((item) => item.price?.type === "recurring" || item.price?.recurring) || items[0];
    if (!recurringItem?.id) {
      return json(
        {
          error: "subscription_item_missing",
          message: "We couldn’t change your plan. Your current plan has not been changed."
        },
        400
      );
    }

    const currentPriceId =
      typeof recurringItem.price === "string" ? recurringItem.price : recurringItem.price?.id;
    if (currentPriceId && currentPriceId === targetPriceId) {
      return json({ error: "same_plan", message: "You are already on this plan." }, 409);
    }

    const isUpgrade = currentPlan === "plus" && targetPlan === "pro";
    const isDowngrade = currentPlan === "pro" && targetPlan === "plus";
    if (!isUpgrade && !isDowngrade) {
      return json({ error: "invalid_plan_change", message: "That plan change is not supported." }, 400);
    }

    const periodEndIso = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : ctx.subscriber.subscription_current_period_end || null;

    if (isDowngrade) {
      const params = new URLSearchParams();
      params.set("items[0][id]", recurringItem.id);
      params.set("items[0][price]", targetPriceId);
      params.set("items[0][quantity]", "1");
      params.set("proration_behavior", "none");
      params.set("metadata[planId]", "plus");
      params.set("metadata[userId]", ctx.subscriber.id);
      params.set("metadata[previousPlanId]", "pro");
      params.set("metadata[pendingPlanId]", "plus");
      params.set("metadata[pendingUpgrade]", "");
      params.set("metadata[pendingDowngrade]", "true");
      params.set("metadata[deferDowngrade]", "true");
      params.set("metadata[deferUntil]", periodEndIso || "");

      await stripeRequest(
        context,
        "POST",
        `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        params
      );

      await adminRest(context, `profiles?id=eq.${encodeURIComponent(ctx.subscriber.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan_id: "pro",
          pending_plan_id: "plus",
          stripe_price_id: targetPriceId,
          entitlement_ends_at: periodEndIso,
          updated_at: new Date().toISOString()
        }),
        headers: { Prefer: "return=minimal" }
      });

      return json({
        ok: true,
        processing: true,
        fromPlan: currentPlan,
        targetPlan,
        deferred: true,
        message:
          "Plus is scheduled for the end of your current Pro billing period. You keep Pro access until then."
      });
    }

    const params = new URLSearchParams();
    params.set("items[0][id]", recurringItem.id);
    params.set("items[0][price]", targetPriceId);
    params.set("items[0][quantity]", "1");
    params.set("proration_behavior", "create_prorations");
    params.set("metadata[planId]", targetPlan);
    params.set("metadata[userId]", ctx.subscriber.id);
    params.set("metadata[previousPlanId]", currentPlan);
    params.set("metadata[pendingPlanId]", targetPlan);
    params.set("metadata[pendingUpgrade]", "true");
    params.set("metadata[pendingDowngrade]", "");
    params.set("metadata[deferDowngrade]", "");
    params.set("metadata[deferUntil]", "");

    await stripeRequest(
      context,
      "POST",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      params
    );

    // Never grant Pro entitlement here — webhooks only.
    await adminRest(context, `profiles?id=eq.${encodeURIComponent(ctx.subscriber.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        plan_id: currentPlan,
        pending_plan_id: targetPlan,
        stripe_price_id: targetPriceId,
        entitlement_ends_at: periodEndIso
      }),
      headers: { Prefer: "return=minimal" }
    });

    return json({
      ok: true,
      processing: true,
      fromPlan: currentPlan,
      targetPlan,
      deferred: false,
      message: "Upgrade requested. Your Prelude plan switches to Pro after Stripe confirms payment."
    });
  } catch (error) {
    if (!error.status && !error.statusCode) {
      console.error("[prelude-billing] change-plan failed", error.message || error);
      return json(
        {
          error: "plan_change_failed",
          message: "We couldn’t change your plan. Your current plan has not been changed."
        },
        500
      );
    }
    return errorResponse(error);
  }
}
