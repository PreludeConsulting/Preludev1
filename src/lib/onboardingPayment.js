/**
 * Onboarding payment helpers — checkout launch and payment confirmation state.
 */

import { appPath } from "./appPaths.js";
import { api } from "./auth.js";
import { getSupabase } from "./supabase.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";

const PAYMENT_DONE_PREFIX = "prelude_payment_done_";

async function getSupabaseAccessToken() {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export function readPaymentStepComplete(userId) {
  if (!userId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${PAYMENT_DONE_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function writePaymentStepComplete(userId) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PAYMENT_DONE_PREFIX}${userId}`, "1");
  } catch {
    /* storage unavailable */
  }
}

export async function startOnboardingBillingCheckout(planId) {
  const accessToken = await getSupabaseAccessToken();
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  return api(appPath("/api/billing/checkout"), {
    method: "POST",
    headers,
    body: JSON.stringify({ planId, context: "onboarding" })
  });
}

export async function confirmOnboardingCheckoutSession(sessionId) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Your session expired. Sign in again to confirm payment.");
  }

  return api(appPath("/api/billing/confirm-session"), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ sessionId })
  });
}

export async function markPendingCheckoutPlan(userId, planId) {
  if (!userId || !isSupabaseConfigured()) return;
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from("onboarding_progress")
    .upsert(
      {
        user_id: userId,
        pending_checkout_plan_id: planId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
}
