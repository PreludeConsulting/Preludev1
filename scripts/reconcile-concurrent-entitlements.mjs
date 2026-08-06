#!/usr/bin/env node
/**
 * Reconcile profiles where Essay Support purchases incorrectly overwrote plan_id,
 * or where an active Stripe subscription should restore Plus/Pro without clearing
 * essay review credits / packages.
 *
 * Usage:
 *   node scripts/reconcile-concurrent-entitlements.mjs [--dry-run]
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (and optionally STRIPE_SECRET_KEY).
 * Does not hardcode users, plans, or credit amounts.
 */
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const stripeKey = process.env.STRIPE_SECRET_KEY || "";

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ACTIVE = new Set(["active", "trialing", "checkout_completed", "promotional"]);

async function resolveStripePlan(subscriptionId) {
  if (!stripeKey || !subscriptionId) return null;
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` }
  });
  if (!response.ok) return null;
  const subscription = await response.json();
  const metaPlan = String(subscription.metadata?.planId || "").toLowerCase();
  if (metaPlan === "plus" || metaPlan === "pro") return metaPlan;
  return null;
}

async function main() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id,email,plan_id,subscription_status,stripe_subscription_id,subscription_current_period_end")
    .not("stripe_subscription_id", "is", null);
  if (error) throw error;

  let inspected = 0;
  let repaired = 0;

  for (const profile of profiles || []) {
    inspected += 1;
    const status = String(profile.subscription_status || "").toLowerCase();
    const currentPlan = String(profile.plan_id || "basic").toLowerCase();
    if (!ACTIVE.has(status)) continue;
    if (currentPlan === "plus" || currentPlan === "pro") continue;

    const stripePlan = await resolveStripePlan(profile.stripe_subscription_id);
    const restoredPlan = stripePlan || null;
    if (!restoredPlan) {
      console.warn(`[skip] ${profile.id} has active-looking status=${status} but plan_id=${currentPlan} and Stripe plan unknown`);
      continue;
    }

    console.info(
      `[repair] ${profile.id} ${profile.email || ""} plan_id ${currentPlan} -> ${restoredPlan}` +
        (dryRun ? " (dry-run)" : "")
    );
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ plan_id: restoredPlan, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (updateError) {
        console.error(`[error] ${profile.id}`, updateError.message);
        continue;
      }
    }
    repaired += 1;
  }

  console.info(JSON.stringify({ inspected, repaired, dryRun }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
