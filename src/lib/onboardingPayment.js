/**
 * Onboarding payment helpers — Payment Link checkout launch and confirmation.
 */

import {
  buildStripePaymentLinkUrl,
  getEssaySupportPaymentLink,
  getSubscriptionPaymentLink,
  isAllowedReviewCreditQuantity
} from "../../shared/stripePaymentLinks.js";
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

function requireCheckoutIdentity(user) {
  const userId = String(user?.id || "").trim();
  const email = String(user?.email || "").trim();
  if (!userId || !email) {
    if (import.meta.env.DEV) {
      console.error("[prelude-checkout] missing checkout identity", {
        hasUserId: Boolean(userId),
        hasEmail: Boolean(email)
      });
    }
    const error = new Error(
      "Your account is missing required checkout details. Please sign in again and retry."
    );
    error.code = "missing_checkout_identity";
    error.status = 401;
    throw error;
  }
  return { userId, email };
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

/**
 * Build Plus/Pro Payment Link URL for onboarding (no Checkout Session API).
 * @param {string} planId
 * @param {{ id?: string, email?: string } | null} user
 */
export function startOnboardingBillingCheckout(planId, user) {
  const { userId, email } = requireCheckoutIdentity(user);
  const link = getSubscriptionPaymentLink(planId);
  if (!link?.url) {
    const error = new Error("That paid plan is not available.");
    error.code = "invalid_plan";
    throw error;
  }
  return {
    url: buildStripePaymentLinkUrl(link.url, { userId, email }),
    paymentLinkId: link.paymentLinkId,
    planId: String(planId).toLowerCase()
  };
}

/**
 * Build Essay Support Payment Link URL for onboarding (no Checkout Session API).
 * @param {{ quantities?: { essayReviews?: number } }} selection
 * @param {{ id?: string, email?: string } | null} user
 */
export function startOnboardingBundleCheckout(selection, user) {
  const { userId, email } = requireCheckoutIdentity(user);
  const credits = Math.floor(Number(selection?.quantities?.essayReviews));
  if (!isAllowedReviewCreditQuantity(credits)) {
    const error = new Error("Choose a valid Essay Support package.");
    error.code = "invalid_package";
    throw error;
  }
  const link = getEssaySupportPaymentLink(credits);
  if (!link?.url) {
    const error = new Error("This Essay Support package is temporarily unavailable.");
    error.code = "package_unavailable";
    throw error;
  }
  return {
    url: buildStripePaymentLinkUrl(link.url, { userId, email }),
    paymentLinkId: link.paymentLinkId,
    credits,
    packageKey: `essay_support_${credits}`,
    totalCents: Math.round(link.price * 100),
    bundleId: "essay_support"
  };
}

/** Authenticated bundle checkout outside onboarding (still uses Checkout Sessions). */
export async function startAuthenticatedBundleCheckout(selection, options = {}) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    const error = new Error("Your session expired. Sign in again to continue to checkout.");
    error.status = 401;
    error.payload = { error: "unauthenticated" };
    throw error;
  }

  return api(appPath("/api/billing/bundle-checkout"), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ ...selection, ...options })
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
