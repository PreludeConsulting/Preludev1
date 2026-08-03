import { api } from "./auth.js";
import { getSupabase } from "./supabase.js";

const BILLING_LOAD_ERROR = "We couldn’t load your billing information. Please try again.";

function mapBillingError(error) {
  if (
    error?.payload?.error === "deployment_misconfigured" ||
    /non-JSON|missing server handlers|couldn’t load this information/i.test(error?.message || "")
  ) {
    const mapped = new Error(BILLING_LOAD_ERROR);
    mapped.status = error.status || 502;
    mapped.payload = { ...(error.payload || {}), message: BILLING_LOAD_ERROR };
    return mapped;
  }
  return error;
}

async function billingRequest(path, options = {}) {
  try {
    const sessionResult = await getSupabase()?.auth.getSession();
    const token = sessionResult?.data?.session?.access_token;
    if (token) {
      return await api(path, {
        ...options,
        headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
      });
    }
    return await api(path, options);
  } catch (error) {
    throw mapBillingError(error);
  }
}

export async function fetchBillingSummary() {
  return billingRequest("/api/billing/summary");
}

export async function consumeEssayReviewCredit() {
  return billingRequest("/api/billing/consume-essay-review", {
    method: "POST",
    body: "{}"
  });
}

export async function fetchBillingHistory({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });
  return billingRequest(`/api/billing/history?${params.toString()}`);
}

export async function cancelMembership() {
  return billingRequest("/api/billing/cancel", { method: "POST", body: "{}" });
}

export async function reactivateMembership() {
  return billingRequest("/api/billing/reactivate", { method: "POST", body: "{}" });
}

/**
 * Switch Plus↔Pro on the existing Stripe subscription (server derives Stripe IDs).
 * @param {"plus"|"pro"|"PLUS"|"PRO"} targetPlan
 */
export async function changeMembershipPlan(targetPlan) {
  try {
    return await billingRequest("/api/billing/change-plan", {
      method: "POST",
      body: JSON.stringify({ targetPlan })
    });
  } catch (error) {
    const mapped = new Error(
      error?.payload?.message ||
        error?.message ||
        "We couldn’t change your plan. Your current plan has not been changed."
    );
    mapped.status = error?.status || 500;
    mapped.payload = {
      ...(error?.payload || {}),
      message: mapped.message
    };
    throw mapped;
  }
}
