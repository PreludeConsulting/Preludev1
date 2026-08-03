/**
 * Idempotent Stripe → Prelude subscription backfill.
 *
 * Usage:
 *   node scripts/backfill-stripe-subscriptions.mjs [--dry-run]
 *
 * Requires STRIPE_SECRET_KEY + Supabase service-role credentials in the environment.
 * Never matches users by email as the primary key — only stripe_customer_id / stripe_subscription_id.
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const serviceKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ""
).trim();
const pricePlus = String(process.env.STRIPE_PRICE_ID_PLUS || process.env.STRIPE_PRICE_PLUS_MONTHLY || "").trim();
const pricePro = String(process.env.STRIPE_PRICE_ID_PRO || process.env.STRIPE_PRICE_PRO_MONTHLY || "").trim();

if (!stripeKey || !supabaseUrl || !serviceKey) {
  console.error("Missing STRIPE_SECRET_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function planForPriceId(priceId) {
  if (priceId && priceId === pricePlus) return "plus";
  if (priceId && priceId === pricePro) return "pro";
  return null;
}

function periodIso(unix) {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

const report = {
  scanned: 0,
  updated: 0,
  skipped: 0,
  unmatched: []
};

const { data: profiles, error } = await supabase
  .from("profiles")
  .select(
    "id, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, pending_plan_id, entitlement_ends_at"
  )
  .or("stripe_customer_id.not.is.null,stripe_subscription_id.not.is.null");

if (error) {
  console.error("Failed to load profiles:", error.message);
  process.exit(1);
}

for (const profile of profiles || []) {
  report.scanned += 1;
  let subscription = null;
  try {
    if (profile.stripe_subscription_id) {
      subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
        expand: ["items.data.price"]
      });
    } else if (profile.stripe_customer_id) {
      const list = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 5,
        expand: ["data.items.data.price"]
      });
      subscription =
        list.data.find((row) => ["active", "trialing", "past_due"].includes(row.status)) ||
        list.data[0] ||
        null;
    }
  } catch (stripeError) {
    report.unmatched.push({
      userId: profile.id,
      reason: "stripe_retrieve_failed",
      detail: stripeError.message
    });
    continue;
  }

  if (!subscription) {
    report.unmatched.push({ userId: profile.id, reason: "no_subscription" });
    report.skipped += 1;
    continue;
  }

  const items = subscription.items?.data || [];
  const recurring = items.find((item) => item.price?.type === "recurring" || item.price?.recurring) || items[0];
  const priceId = typeof recurring?.price === "string" ? recurring.price : recurring?.price?.id;
  const planId = planForPriceId(priceId) || profile.plan_id || null;
  if (!planId || (planId !== "plus" && planId !== "pro")) {
    report.unmatched.push({
      userId: profile.id,
      reason: "price_unmapped",
      priceId: priceId || null
    });
    report.skipped += 1;
    continue;
  }

  const active = ["active", "trialing"].includes(subscription.status);
  const periodEnd = periodIso(subscription.current_period_end);
  const defer =
    String(subscription.metadata?.deferDowngrade || "").toLowerCase() === "true" &&
    String(subscription.metadata?.previousPlanId || "").toLowerCase() === "pro";
  const patch = {
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId || null,
    subscription_status: subscription.status,
    subscription_current_period_start: periodIso(subscription.current_period_start),
    subscription_current_period_end: periodEnd,
    subscription_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    entitlement_ends_at: periodEnd,
    plan_id: defer && active ? "pro" : active ? planId : profile.plan_id,
    pending_plan_id: defer && active ? "plus" : null
  };

  if (dryRun) {
    console.log("[dry-run]", profile.id, patch);
    report.updated += 1;
    continue;
  }

  const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", profile.id);
  if (updateError) {
    report.unmatched.push({ userId: profile.id, reason: "update_failed", detail: updateError.message });
    continue;
  }
  report.updated += 1;
}

console.log(JSON.stringify(report, null, 2));
