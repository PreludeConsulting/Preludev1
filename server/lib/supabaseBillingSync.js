import {
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful
} from "../../shared/stripePaymentLinks.js";
import {
  CLEARED_PENDING_UPGRADE_METADATA,
  resolveSubscriptionPlanEntitlement
} from "../../shared/billingSubscriptionSync.js";
import { getSupabaseAdmin } from "./supabaseRequestAuth.js";
import { persistSubscriptionFields, recordPurchaseFromCheckoutSession } from "./billingMembership.js";
import { reconcileActiveSessionPeriodForPlanChange } from "./sessionCredits.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

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

  const entitlement = resolveSubscriptionPlanEntitlement({
    priorPlanId,
    mappedPlanId,
    paymentConfirmed: confirmed,
    metadata: subscription.metadata
  });
  const planId = active ? entitlement.activePlanId : mappedPlanId || null;

  await persistSubscriptionFields(userId, subscription, planId, {
    pendingPlanId: active ? entitlement.pendingPlanId : subscription.metadata?.pendingPlanId || null,
    paymentConfirmed: confirmed
  });

  if (planId && active) {
    await syncSupabasePaymentComplete(userId, {
      planId,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status || null,
      currentPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      pendingPlanId: entitlement.pendingPlanId
    });
    try {
      if (confirmed) {
        await reconcileActiveSessionPeriodForPlanChange(userId, planId);
      }
    } catch (error) {
      console.error("[prelude-billing] session credit reconcile failed", error.message);
    }
  } else if (userId) {
    // Still persist status/period when canceled or past_due without forcing plan_id to basic mid-period.
    await persistSubscriptionFields(userId, subscription, planId, { paymentConfirmed: confirmed });
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

  // Paid monthly plan or support bundle both complete onboarding payment.
  if (planId) {
    await syncSupabasePaymentComplete(userId, {
      planId,
      stripeCustomerId: typeof enriched.customer === "string" ? enriched.customer : enriched.customer?.id,
      stripeSubscriptionId:
        typeof enriched.subscription === "string" ? enriched.subscription : enriched.subscription?.id,
      // $0 fully-discounted subscriptions still activate when payment_status is paid/no_payment_required.
      subscriptionStatus: enriched.status || "checkout_completed",
      pendingPlanId: null
    });
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
