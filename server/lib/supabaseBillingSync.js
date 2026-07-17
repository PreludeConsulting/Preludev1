import { getSupabaseAdmin } from "./supabaseRequestAuth.js";
import { persistSubscriptionFields, recordPurchaseFromCheckoutSession } from "./billingMembership.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export async function syncSupabasePaymentComplete(userId, {
  planId,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  subscriptionStatus = "active",
  currentPeriodStart = null,
  currentPeriodEnd = null,
  cancelAtPeriodEnd = null,
  canceledAt = null
} = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !userId || !planId) return;

  const profilePatch = {
    plan_id: planId,
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
    ...(subscriptionStatus ? { subscription_status: subscriptionStatus } : {}),
    ...(currentPeriodStart ? { subscription_current_period_start: currentPeriodStart } : {}),
    ...(currentPeriodEnd ? { subscription_current_period_end: currentPeriodEnd } : {}),
    ...(cancelAtPeriodEnd != null ? { subscription_cancel_at_period_end: Boolean(cancelAtPeriodEnd) } : {}),
    ...(canceledAt !== undefined ? { subscription_canceled_at: canceledAt } : {})
  };

  await supabase.from("profiles").update(profilePatch).eq("id", userId);
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

export async function syncSupabaseSubscription(subscription, resolvedPlanId = null) {
  const userId = subscription.metadata?.userId;
  const planId = resolvedPlanId || subscription.metadata?.planId;
  if (!userId) return;

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  await persistSubscriptionFields(userId, subscription, active ? planId : planId || null);

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
  } else if (userId) {
    // Still persist status/period when canceled or past_due without forcing plan_id to basic mid-period.
    await persistSubscriptionFields(userId, subscription, planId);
  }
}

export async function syncSupabaseCheckoutSession(session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  const planId = session.metadata?.planId;
  if (!userId || !planId) {
    if (userId) {
      try {
        await recordPurchaseFromCheckoutSession(session);
      } catch (error) {
        console.error("[prelude-billing] purchase history checkout sync failed", error.message);
      }
    }
    return;
  }
  if (session.payment_status && session.payment_status !== "paid") return;

  await syncSupabasePaymentComplete(userId, {
    planId,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
    stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
    subscriptionStatus: session.status || "checkout_completed"
  });

  try {
    await recordPurchaseFromCheckoutSession(session);
  } catch (error) {
    console.error("[prelude-billing] purchase history checkout sync failed", error.message);
  }
}
