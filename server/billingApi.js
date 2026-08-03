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
  PURCHASABLE_PLAN_IDS,
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
import { creditSessionPackagePurchase, consumeEssayReviewCredit } from "./lib/mentorAccess.js";
import { grantEssaySupportPurchase } from "./lib/reviewCredits.js";
import {
  expireSessionPeriodsAtPeriodEnd,
  grantSessionCreditsFromPaidInvoice,
  reconcileActiveSessionPeriodForPlanChange
} from "./lib/sessionCredits.js";
import {
  fulfillFlexibleSessionCheckout,
  fulfillEssaySupportCheckout
} from "./lib/sessionPackageFulfillment.js";
import { withApiRateLimit } from "./lib/apiRateLimitMiddleware.js";
import { resolveEssaySupportCheckoutPackage } from "../shared/essaySupportPackages.js";
import {
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful
} from "../shared/stripePaymentLinks.js";
import {
  cancelMembershipAtPeriodEnd,
  changeMembershipPlan,
  claimBillingWebhookEvent,
  getBillingSummary,
  getMySubscription,
  listBillingPurchases,
  reactivateMembershipRenewal,
  recordPurchaseFromCheckoutSession,
  recordPurchaseFromInvoice,
  resolveBillingContext
} from "./lib/billingMembership.js";
import { logBillingEvent } from "../shared/billingMembership.js";

const checkoutSchema = z.object({
  planId: z.enum(["plus", "pro"]),
  guestCheckout: z.boolean().optional(),
  context: z.enum(["onboarding", "public"]).optional()
});

export const bundleCheckoutSchema = z.object({
  bundleId: z.enum([
    "essay_support",
    // Legacy IDs still accepted and remapped by quoteBundleSelection.
    "application_support",
    "college_application"
  ]),
  packageKey: z.string().trim().min(1).max(64).optional(),
  quantities: z.record(z.number()).optional(),
  addOns: z.record(z.boolean()).optional(),
  services: z.record(z.boolean()).optional(),
  sessionUses: z.record(z.boolean()).optional(),
  guestCheckout: z.boolean().optional(),
  context: z.enum(["onboarding", "public"]).optional(),
  mentorId: z.string().trim().max(80).optional(),
  mentorUserId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional()
}).strict();

const confirmSessionSchema = z.object({
  sessionId: z.string().trim().min(1)
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const changePlanSchema = z
  .object({
    targetPlan: z.enum(["plus", "pro", "PLUS", "PRO"])
  })
  .strict();

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
    pathname === "/api/billing/webhook" ||
    pathname === "/api/stripe-webhook" ||
    pathname === "/api/billing/summary" ||
    pathname === "/api/me/subscription" ||
    pathname === "/api/billing/history" ||
    pathname === "/api/billing/cancel" ||
    pathname === "/api/billing/reactivate" ||
    pathname === "/api/billing/change-plan" ||
    pathname === "/api/billing/consume-essay-review"
  );
}

function checkoutResultUrls(appBaseUrl, planId, context) {
  const contextQuery = context === "onboarding" ? "&context=onboarding" : "";
  return {
    successUrl: `${appBaseUrl}/checkout/success?plan=${planId}${contextQuery}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appBaseUrl}/checkout/cancel?plan=${planId}${contextQuery}`
  };
}

async function assertPurchaserCanBuyForStudent(purchaserUserId, studentId) {
  if (!purchaserUserId || !studentId || purchaserUserId === studentId) return;
  const admin = getSupabaseAdmin();
  if (!admin) {
    const error = new Error("Unable to verify purchase authorization.");
    error.statusCode = 503;
    throw error;
  }
  const { data: link, error } = await admin
    .from("parent_student_links")
    .select("id")
    .eq("parent_id", purchaserUserId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) {
    const wrapped = new Error("Unable to verify purchase authorization.");
    wrapped.statusCode = 500;
    throw wrapped;
  }
  if (!link) {
    const forbidden = new Error("You are not authorized to purchase Essay Support for this student.");
    forbidden.statusCode = 403;
    throw forbidden;
  }
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
    paidPlans: PURCHASABLE_PLAN_IDS
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

  const quantity = Object.values(quote.selection.quantities)[0];
  const resolvedPackage = resolveEssaySupportCheckoutPackage(
    {
      packageKey: payload.packageKey,
      quantities: quote.selection.quantities,
      credits: quantity
    },
    process.env
  );
  if (!resolvedPackage.ok) {
    return sendJson(res, 400, {
      error: resolvedPackage.error,
      message: resolvedPackage.message
    });
  }

  const authUser = await resolveCheckoutAuth(req, payload);
  const studentId = payload.studentId || authUser?.userId || null;
  if (authUser?.userId && payload.studentId) {
    try {
      await assertPurchaserCanBuyForStudent(authUser.userId, payload.studentId);
    } catch (authError) {
      return sendJson(res, authError.statusCode || 403, {
        error: "forbidden",
        message: authError.message
      });
    }
  }
  const stripe = getStripeClient(config);
  const priceId =
    resolvedPackage.package.stripePriceId ||
    getBundlePriceId(quote.selection.bundleId, quantity, config);
  if (!priceId) {
    return sendJson(res, 400, {
      error: "package_unavailable",
      message: "This Essay Support package is temporarily unavailable."
    });
  }
  await requireMatchingStripePrice(stripe, {
    priceId,
    expectedCents: resolvedPackage.package.amountCents || quote.totalCents,
    recurring: false,
    offeringId: quote.selection.bundleId,
    label: `${quote.selection.bundleId} (${quantity})`
  });
  const customerId = authUser ? await ensureStripeCustomerForCheckout(authUser, config) : null;
  const appBaseUrl = getAppBaseUrl(req);
  const purchaseKey = `bundle_${quote.selection.bundleId}`;
  const { successUrl, cancelUrl } = checkoutResultUrls(appBaseUrl, purchaseKey, payload.context);
  const metadata = {
    ...serializeBundleMetadata(quote, {
      studentId,
      purchaserUserId: authUser?.userId || null
    }),
    packageKey: resolvedPackage.package.packageKey,
    creditQuantity: String(resolvedPackage.package.credits),
    ...(authUser
      ? { userId: studentId || authUser.userId, checkoutContext: payload.context || "public" }
      : { checkoutMode: "guest_test" }),
    ...(payload.mentorUserId ? { mentorUserId: payload.mentorUserId } : {}),
    ...(payload.mentorId ? { mentorId: payload.mentorId } : {})
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(customerId ? { customer: customerId } : {}),
    ...(authUser ? { client_reference_id: studentId || authUser.userId } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata
  });

  sendJson(res, 200, {
    url: session.url,
    totalCents: quote.totalCents,
    bundleId: quote.selection.bundleId,
    packageKey: resolvedPackage.package.packageKey
  });
}

async function handleConfirmSession(req, res, deps = {}) {
  const getBillingConfigFn = deps.getBillingConfigFn || getBillingConfig;
  const requireSupabaseUserFn = deps.requireSupabaseUserFn || requireSupabaseUser;
  const getStripeClientFn = deps.getStripeClientFn || getStripeClient;
  const syncSupabaseCheckoutSessionFn = deps.syncSupabaseCheckoutSessionFn || syncSupabaseCheckoutSession;
  const fulfillFlexibleSessionCheckoutFn = deps.fulfillFlexibleSessionCheckoutFn || fulfillFlexibleSessionCheckout;
  const fulfillEssaySupportCheckoutFn = deps.fulfillEssaySupportCheckoutFn || fulfillEssaySupportCheckout;
  const recordPurchaseFromCheckoutSessionFn = deps.recordPurchaseFromCheckoutSessionFn || recordPurchaseFromCheckoutSession;

  const config = getBillingConfigFn();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  const payload = confirmSessionSchema.parse(await readJsonBody(req));
  const { user } = await requireSupabaseUserFn(req);
  const stripe = getStripeClientFn(config);
  const rawSession = await stripe.checkout.sessions.retrieve(payload.sessionId);
  const session = enrichCheckoutSessionFromPaymentLink(rawSession);

  const sessionUserId = session.metadata?.userId || session.client_reference_id;
  if (!sessionUserId || sessionUserId !== user.id) {
    return sendJson(res, 403, { error: "forbidden", message: "That checkout session does not belong to this account." });
  }

  if (!isCheckoutPaymentSuccessful(session)) {
    return sendJson(res, 409, {
      error: "payment_pending",
      message: "Stripe has not confirmed payment for this checkout session yet.",
      paymentStatus: session.payment_status
    });
  }

  await syncSupabaseCheckoutSessionFn(session);
  await fulfillFlexibleSessionCheckoutFn(session, creditSessionPackagePurchase);
  await fulfillEssaySupportCheckoutFn(session, async (credit) =>
    grantEssaySupportPurchase({
      studentUserId: credit.studentUserId,
      credits: credit.sessionsPurchased,
      packageKey: credit.packageKey || `essay_support_${credit.sessionsPurchased}`,
      stripeCheckoutSessionId: credit.stripeCheckoutSessionId,
      createdByUserId: credit.purchaserUserId || null
    })
  );
  try {
    await recordPurchaseFromCheckoutSessionFn(session);
  } catch (error) {
    console.error("[prelude-billing] confirm-session purchase history failed", error.message);
  }
  sendJson(res, 200, {
    confirmed: true,
    planId: session.metadata?.planId || null,
    paymentStatus: session.payment_status
  });
}

async function resolveStripeCustomerIdForUser(userId) {
  const ctx = await resolveBillingContext(userId);
  return (
    ctx.subscriber?.stripe_customer_id ||
    ctx.viewer?.stripe_customer_id ||
    null
  );
}

async function handlePortal(req, res) {
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));

  let userId;
  let customerId;
  try {
    const { user } = await requireSupabaseUser(req);
    userId = user.id;
    customerId = await resolveStripeCustomerIdForUser(user.id);
  } catch {
    const auth = await requireAuth(req);
    requireCsrf(req);
    userId = auth.user.id;
    customerId = auth.user.stripeCustomerId || null;
  }

  if (!customerId) {
    return sendJson(res, 400, {
      error: "billing_customer_missing",
      message: "No billing profile exists for this account yet."
    });
  }

  const stripe = getStripeClient(config);
  const returnPath = "/dashboard/student/billing?portal=return";
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppBaseUrl(req)}${returnPath}`
  });

  logBillingEvent("portal_opened", { userId });
  sendJson(res, 200, { url: session.url });
}

async function handleSummary(req, res) {
  const { user } = await requireSupabaseUser(req);
  const summary = await getBillingSummary(user.id);
  return sendJson(res, 200, summary);
}

async function handleMySubscription(req, res) {
  const { user } = await requireSupabaseUser(req);
  const subscription = await getMySubscription(user.id);
  return sendJson(res, 200, subscription);
}

async function handleConsumeEssayReview(req, res) {
  const { user } = await requireSupabaseUser(req);
  const packageId = await consumeEssayReviewCredit(user.id);
  if (!packageId) {
    return sendJson(res, 409, {
      error: "no_essay_credits",
      message: "No purchased essay review credits remaining."
    });
  }
  return sendJson(res, 200, { consumed: true, packageId });
}

async function handleHistory(req, res) {
  const { user } = await requireSupabaseUser(req);
  const url = new URL(req.url, "http://localhost");
  const query = historyQuerySchema.parse({
    limit: url.searchParams.get("limit") || undefined,
    offset: url.searchParams.get("offset") || undefined
  });
  const history = await listBillingPurchases(user.id, query);
  return sendJson(res, 200, history);
}

async function handleCancel(req, res) {
  const { user } = await requireSupabaseUser(req);
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));
  const stripe = getStripeClient(config);
  const result = await cancelMembershipAtPeriodEnd(user.id, { stripe });
  return sendJson(res, 200, result);
}

async function handleReactivate(req, res) {
  const { user } = await requireSupabaseUser(req);
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));
  const stripe = getStripeClient(config);
  const result = await reactivateMembershipRenewal(user.id, { stripe });
  return sendJson(res, 200, result);
}

async function handleChangePlan(req, res) {
  const { user } = await requireSupabaseUser(req);
  const config = getBillingConfig();
  if (!config.enabled) return sendJson(res, 503, billingNotConfiguredPayload(config));
  const body = changePlanSchema.parse(await readJsonBody(req));
  // Ignore any browser-supplied Stripe IDs — only targetPlan is accepted.
  const stripe = getStripeClient(config);
  try {
    const result = await changeMembershipPlan(user.id, body.targetPlan, {
      stripe,
      getPlanPriceId: (planId) => getPlanPriceId(planId, config)
    });
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    if (status >= 500) {
      console.error("[prelude-billing] change-plan failed", error.code || error.message);
    }
    return sendJson(res, status, {
      error: error.code || "plan_change_failed",
      message:
        status >= 500
          ? "We couldn’t change your plan. Your current plan has not been changed."
          : error.message || "We couldn’t change your plan. Your current plan has not been changed."
    });
  }
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

async function syncSubscription(subscription, { paymentConfirmed = false } = {}) {
  const config = getBillingConfig();
  let planId = resolvePlanIdFromSubscription(subscription, config);
  await syncSupabaseSubscription(subscription, planId, { paymentConfirmed });

  const user = await findUserForSubscription(subscription);
  if (!user) return;

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  const priorPlan = String(user.plan || "").toLowerCase();
  const pendingUpgrade =
    String(subscription.metadata?.pendingUpgrade || "").toLowerCase() === "true" ||
    (priorPlan === "plus" && String(planId || "").toLowerCase() === "pro" && !paymentConfirmed);
  if (active && pendingUpgrade && !paymentConfirmed) {
    planId = "plus";
  }

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

  // Credits only after paid confirmation — never on unpaid subscription.updated.
  if (paymentConfirmed && active && planId && (planId === "plus" || planId === "pro")) {
    try {
      await reconcileActiveSessionPeriodForPlanChange(user.id, planId);
    } catch (error) {
      console.error("[prelude-billing] session credit reconcile failed", error.message);
    }
  }
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

  try {
    const first = await claimBillingWebhookEvent(event.id, event.type, { type: event.type });
    if (!first) return;
  } catch (error) {
    console.error("[prelude-billing] webhook claim failed", error.message);
  }

  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await syncSubscription(object);
    const subUser = await findUserForSubscription(object);
    if (subUser?.id) {
      // Expire unused credits only when the paid period has ended (Stripe period_end).
      await expireSessionPeriodsAtPeriodEnd(subUser.id);
    }
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = enrichCheckoutSessionFromPaymentLink(object);
    await syncSupabaseCheckoutSession(session);
    await fulfillFlexibleSessionCheckout(session, creditSessionPackagePurchase);
    await fulfillEssaySupportCheckout(session, async (credit) =>
      grantEssaySupportPurchase({
        studentUserId: credit.studentUserId,
        credits: credit.sessionsPurchased,
        packageKey: credit.packageKey || `essay_support_${credit.sessionsPurchased}`,
        stripeCheckoutSessionId: credit.stripeCheckoutSessionId,
        createdByUserId: credit.purchaserUserId || null
      })
    );
    try {
      await recordPurchaseFromCheckoutSession(session);
    } catch (error) {
      console.error("[prelude-billing] webhook purchase history failed", error.message);
    }
    const userId = session.metadata?.userId || session.client_reference_id;
    const customerId = stripeObjectId(session.customer);
    const subscriptionId = stripeObjectId(session.subscription);
    const planId = session.metadata?.planId;
    if (userId && subscriptionId && planId && PAID_PLAN_IDS.includes(planId)) {
      // Stamp subscription metadata so later invoice/subscription webhooks resolve the user.
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.update(subscriptionId, {
          metadata: {
            userId,
            planId,
            checkoutContext: session.metadata?.checkoutContext || "onboarding"
          }
        });
      } catch (error) {
        console.error("[prelude-billing] subscription metadata stamp failed", error.message);
      }
    }
    if (userId && PAID_PLAN_IDS.includes(planId)) {
      try {
        await db().user.update({
          where: { id: userId },
          data: {
            plan: normalizePlan(planId),
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: session.status || "checkout_completed"
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
    await syncSubscription(subscription, { paymentConfirmed: true });
    try {
      await recordPurchaseFromInvoice(object, subscription);
    } catch (error) {
      console.error("[prelude-billing] invoice purchase history failed", error.message);
    }

    try {
      const planId = resolvePlanIdFromSubscription(subscription);
      const studentUserId =
        subscription.metadata?.userId ||
        (await findUserForSubscription(subscription))?.id ||
        null;
      if (studentUserId && planId) {
        await grantSessionCreditsFromPaidInvoice({
          studentUserId,
          planId,
          invoice: object,
          subscription,
          stripeEventId: event.id
        });
      }
    } catch (error) {
      console.error("[prelude-billing] session credit grant failed", error.message);
    }

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
  if (["invoice.payment_failed"].includes(event.type) && invoiceSubscriptionId) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
    await syncSubscription(subscription);
    logBillingEvent("renewal_failed", {
      subscriptionId: invoiceSubscriptionId,
      invoiceId: object.id
    });
  }
  if (["charge.refunded", "charge.dispute.created"].includes(event.type)) {
    const paymentId = stripeObjectId(object.payment_intent) || object.id;
    await revokeRewardsForQualifyingPayment(paymentId, event.type);
  }
  if (event.type === "invoice.voided") {
    const paymentId = stripeObjectId(object.payment_intent) || object.id;
    if (paymentId) await revokeRewardsForQualifyingPayment(paymentId, event.type);
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

export function createBillingApiMiddleware(deps = {}) {
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
      if (url.pathname === "/api/billing/confirm-session" && req.method === "POST") return await handleConfirmSession(req, res, deps);
      if (url.pathname === "/api/billing/portal" && req.method === "POST") return await handlePortal(req, res);
      if (url.pathname === "/api/billing/summary" && req.method === "GET") return await handleSummary(req, res);
      if (url.pathname === "/api/me/subscription" && req.method === "GET") return await handleMySubscription(req, res);
      if (url.pathname === "/api/billing/consume-essay-review" && req.method === "POST") {
        return await handleConsumeEssayReview(req, res);
      }
      if (url.pathname === "/api/billing/history" && req.method === "GET") return await handleHistory(req, res);
      if (url.pathname === "/api/billing/cancel" && req.method === "POST") return await handleCancel(req, res);
      if (url.pathname === "/api/billing/reactivate" && req.method === "POST") return await handleReactivate(req, res);
      if (url.pathname === "/api/billing/change-plan" && req.method === "POST") return await handleChangePlan(req, res);
      if (
        (url.pathname === "/api/billing/webhook" || url.pathname === "/api/stripe-webhook") &&
        req.method === "POST"
      ) {
        return await handleWebhook(req, res);
      }
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

function billingHandler(req, res) {
  return middleware(req, res, () => {
    sendJson(res, 404, { error: "not_found" });
  });
}

export default withApiRateLimit(billingHandler);
