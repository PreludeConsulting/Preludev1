import {
  enrichCheckoutSessionFromPaymentLink,
  isCheckoutPaymentSuccessful
} from "../../shared/stripePaymentLinks.js";
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
  canceledAt = undefined
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
    ...(canceledAt !== undefined ? { subscription_canceled_at: canceledAt } : {})
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
  let planId = resolvedPlanId || subscription.metadata?.planId;
  if (!userId) return;

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  const pendingUpgrade =
    String(subscription.metadata?.pendingUpgrade || "").toLowerCase() === "true" ||
    (priorPlanId === "plus" && String(planId || "").toLowerCase() === "pro" && !paymentConfirmed);
  if (active && pendingUpgrade && !paymentConfirmed) {
    planId = "plus";
  }

  await persistSubscriptionFields(userId, subscription, active ? planId : planId || null, {
    pendingPlanId:
      active && pendingUpgrade && !paymentConfirmed
        ? "pro"
        : subscription.metadata?.pendingPlanId || null
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
        : null
    });
    try {
      const deferDowngrade =
        String(subscription.metadata?.deferDowngrade || "").toLowerCase() === "true";
      // Only reconcile credits after a paid confirmation (invoice.paid) or non-upgrade updates.
      if (!deferDowngrade && paymentConfirmed) {
        await reconcileActiveSessionPeriodForPlanChange(userId, planId);
      }
    } catch (error) {
      console.error("[prelude-billing] session credit reconcile failed", error.message);
    }
  } else if (userId) {
    // Still persist status/period when canceled or past_due without forcing plan_id to basic mid-period.
    await persistSubscriptionFields(userId, subscription, planId);
  }
}

export async function syncSupabaseCheckoutSession(session) {
  const enriched = enrichCheckoutSessionFromPaymentLink(session);
  const userId = enriched.metadata?.userId || enriched.client_reference_id;
  const planId = enriched.metadata?.planId;
  const bundleId = String(enriched.metadata?.bundleId || "").trim();
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
      subscriptionStatus: enriched.status || "checkout_completed"
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
