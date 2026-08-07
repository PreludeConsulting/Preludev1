import {
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful
} from "../../shared/stripePaymentLinks.js";
import {
  CLEARED_PENDING_UPGRADE_METADATA,
  resolveSubscriptionPlanEntitlement
} from "../../shared/billingSubscriptionSync.js";
import { resolvePaidMembershipPeriodBounds } from "../../shared/sessionPeriodEnsure.js";
import { normalizePersistedSubscriptionStatus } from "../../shared/stripeSubscriptionStatus.js";
import { getSupabaseAdmin } from "./supabaseRequestAuth.js";
import { persistSubscriptionFields, recordPurchaseFromCheckoutSession } from "./billingMembership.js";
import {
  ensureSessionPeriodForActiveSubscription,
  reconcileActiveSessionPeriodForPlanChange
} from "./sessionCredits.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "checkout_completed", "complete"]);

export async function syncSupabasePaymentComplete(userId, {
  planId = null,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  subscriptionStatus = undefined,
  currentPeriodStart = null,
  currentPeriodEnd = null,
  cancelAtPeriodEnd = undefined,
  canceledAt = undefined,
  pendingPlanId = undefined
} = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !userId) return;

  // Monthly plan checkout sets plan_id. Bundle-only checkout unlocks the
  // payment step without assigning a subscription plan.
  const profilePatch = {
    ...(planId ? { plan_id: planId } : {}),
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
    ...(subscriptionStatus != null ? { subscription_status: subscriptionStatus } : {}),
    ...(currentPeriodStart ? { subscription_current_period_start: currentPeriodStart } : {}),
    ...(currentPeriodEnd ? { subscription_current_period_end: currentPeriodEnd } : {}),
    ...(cancelAtPeriodEnd !== undefined ? { subscription_cancel_at_period_end: Boolean(cancelAtPeriodEnd) } : {}),
    ...(canceledAt !== undefined ? { subscription_canceled_at: canceledAt } : {}),
    ...(pendingPlanId !== undefined ? { pending_plan_id: pendingPlanId } : {})
  };

  if (Object.keys(profilePatch).length > 0) {
    await supabase.from("profiles").update(profilePatch).eq("id", userId);
  }
  await supabase.from("onboarding_progress").upsert(
    {
      user_id: userId,
      payment_step_completed: true,
      pending_checkout_plan_id: null,
      onboarding_status: "onboarding_completed",
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
}

async function findProfileIdByStripeCustomer(customerId) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !customerId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id || null;
}

async function clearPendingUpgradeMetadata(subscriptionId) {
  if (!subscriptionId) return;
  try {
    const { getBillingConfig, STRIPE_API_VERSION } = await import("../billingConfig.js");
    const Stripe = (await import("stripe")).default;
    const config = getBillingConfig();
    if (!config.stripeSecretKey) return;
    const stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
      appInfo: { name: "Prelude", version: "1.0.0" },
      maxNetworkRetries: 2
    });
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { ...CLEARED_PENDING_UPGRADE_METADATA }
    });
  } catch (error) {
    console.error("[prelude-billing] pending upgrade metadata clear failed", error.message);
  }
}

export async function syncSupabaseSubscription(subscription, resolvedPlanId = null, { paymentConfirmed = false } = {}) {
  let userId = subscription.metadata?.userId || null;
  let priorPlanId = null;
  if (!userId) {
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    userId = await findProfileIdByStripeCustomer(customerId);
  }
  if (userId) {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("profiles").select("plan_id").eq("id", userId).maybeSingle();
    priorPlanId = data?.plan_id ? String(data.plan_id).toLowerCase() : null;
  }
  const mappedPlanId = resolvedPlanId || subscription.metadata?.planId;
  if (!userId) return;

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  let confirmed = Boolean(paymentConfirmed);
  if (!confirmed && priorPlanId === "plus" && String(mappedPlanId || "").toLowerCase() === "pro") {
    const latestInvoiceId =
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id || null;
    if (latestInvoiceId) {
      try {
        const { getBillingConfig, STRIPE_API_VERSION } = await import("../billingConfig.js");
        const Stripe = (await import("stripe")).default;
        const config = getBillingConfig();
        if (config.stripeSecretKey) {
          const stripe = new Stripe(config.stripeSecretKey, {
            apiVersion: STRIPE_API_VERSION,
            appInfo: { name: "Prelude", version: "1.0.0" },
            maxNetworkRetries: 2
          });
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          if (invoice?.status === "paid" || invoice?.paid === true) {
            confirmed = true;
          }
        }
      } catch (error) {
        console.error("[prelude-billing] pending upgrade invoice lookup failed", error.message);
      }
    }
  }

  const paidBounds = resolvePaidMembershipPeriodBounds(subscription);
  const periodStartIso = paidBounds.startIso;
  const periodEndIso = paidBounds.endIso;
  const entitlement = resolveSubscriptionPlanEntitlement({
    priorPlanId,
    mappedPlanId,
    paymentConfirmed: confirmed,
    metadata: subscription.metadata,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: periodEndIso
  });
  const stillInPaidPeriod =
    periodEndIso && new Date(periodEndIso).getTime() > Date.now();
  // Prefer effective entitlement over raw Stripe price mapping — keeps Pro during
  // scheduled Plus downgrades and through cancel_at_period_end paid windows.
  let planId = entitlement.activePlanId || (active ? mappedPlanId : null) || null;
  if (
    !active &&
    stillInPaidPeriod &&
    (priorPlanId === "pro" || priorPlanId === "plus")
  ) {
    planId = priorPlanId === "pro" ? "pro" : priorPlanId;
  }
  const pendingPlanId = entitlement.pendingPlanId || entitlement.scheduledPlanId || null;

  await persistSubscriptionFields(userId, subscription, planId, {
    priorPlanId,
    pendingPlanId,
    paymentConfirmed: confirmed
  });

  if (planId && active) {
    await syncSupabasePaymentComplete(userId, {
      planId,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status || null,
      currentPeriodStart: periodStartIso,
      currentPeriodEnd: periodEndIso,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      pendingPlanId
    });
    try {
      // Plus→Pro mid-cycle allowance reset still requires confirmed payment.
      if (confirmed) {
        await reconcileActiveSessionPeriodForPlanChange(userId, planId);
      }
      // Period #1 starts when Stripe marks the subscription active — do not wait for
      // a separate invoice.paid / paymentConfirmed flag (subscription.updated often
      // arrives first and previously left remaining=0 forever).
      if (
        (planId === "plus" || planId === "pro") &&
        periodStartIso &&
        periodEndIso &&
        ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
      ) {
        await ensureSessionPeriodForActiveSubscription({
          studentUserId: userId,
          planId,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          stripeSubscriptionId: subscription.id
        });
      }
    } catch (error) {
      console.error("[prelude-billing] session credit reconcile failed", error.message);
    }
  } else if (userId) {
    // Still persist status/period when canceled or past_due without forcing plan_id to basic mid-period.
    await persistSubscriptionFields(userId, subscription, planId, {
      priorPlanId,
      pendingPlanId,
      paymentConfirmed: confirmed
    });
  }

  if (entitlement.shouldClearPendingMetadata) {
    await clearPendingUpgradeMetadata(subscription.id);
  }
}

export async function syncSupabaseCheckoutSession(session) {
  const enriched = enrichCheckoutSessionFromPaymentLink(session);
  const userId = enriched.metadata?.userId || enriched.client_reference_id;
  const bundleId = String(enriched.metadata?.bundleId || "").trim();
  const purchaseType = String(enriched.metadata?.purchaseType || "").trim().toUpperCase();
  const isEssayCheckout = bundleId === "essay_support" || purchaseType === "ESSAY_SUPPORT";
  // Essay Support is additive — never write plan_id from essay checkout metadata.
  const planId = isEssayCheckout ? null : enriched.metadata?.planId;
  if (!userId) return;
  if (!isCheckoutPaymentSuccessful(enriched)) return;

  const subscriptionId =
    typeof enriched.subscription === "string" ? enriched.subscription : enriched.subscription?.id || null;

  // Paid monthly plan or support bundle both complete onboarding payment.
  if (planId) {
    // Never persist Checkout Session.status ("complete") as subscription_status —
    // that overwrote Stripe "active" and made Plans & Billing show Inactive.
    await syncSupabasePaymentComplete(userId, {
      planId,
      stripeCustomerId: typeof enriched.customer === "string" ? enriched.customer : enriched.customer?.id,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: normalizePersistedSubscriptionStatus(null, { paymentSuccessful: true }),
      pendingPlanId: null
    });

    // Authoritative: pull the Subscription object for status, period bounds, and credits.
    if (subscriptionId) {
      try {
        const { getBillingConfig, STRIPE_API_VERSION } = await import("../billingConfig.js");
        const Stripe = (await import("stripe")).default;
        const config = getBillingConfig();
        if (config.stripeSecretKey) {
          const stripe = new Stripe(config.stripeSecretKey, {
            apiVersion: STRIPE_API_VERSION,
            appInfo: { name: "Prelude", version: "1.0.0" },
            maxNetworkRetries: 2
          });
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price", "latest_invoice", "latest_invoice.lines.data"]
          });
          await syncSupabaseSubscription(subscription, planId, { paymentConfirmed: true });
        }
      } catch (error) {
        console.error("[prelude-billing] checkout subscription sync failed", error.message);
      }
    }
  } else if (bundleId) {
    await syncSupabasePaymentComplete(userId, {
      stripeCustomerId: typeof enriched.customer === "string" ? enriched.customer : enriched.customer?.id
    });
  }

  try {
    await recordPurchaseFromCheckoutSession(enriched);
  } catch (error) {
    console.error("[prelude-billing] purchase history checkout sync failed", error.message);
  }
}
