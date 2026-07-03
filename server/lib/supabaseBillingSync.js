import { getSupabaseAdmin } from "./supabaseRequestAuth.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export async function syncSupabasePaymentComplete(userId, {
  planId,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  subscriptionStatus = "active"
} = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !userId || !planId) return;

  const profilePatch = {
    plan_id: planId,
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
    ...(subscriptionStatus ? { subscription_status: subscriptionStatus } : {})
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

export async function syncSupabaseSubscription(subscription) {
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;
  if (!userId || !planId) return;

  const active = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
  await syncSupabasePaymentComplete(userId, {
    planId: active ? planId : "basic",
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status || null
  });
}

export async function syncSupabaseCheckoutSession(session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  const planId = session.metadata?.planId;
  if (!userId || !planId) return;
  if (session.payment_status && session.payment_status !== "paid") return;

  await syncSupabasePaymentComplete(userId, {
    planId,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
    stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
    subscriptionStatus: session.status || "checkout_completed"
  });
}
