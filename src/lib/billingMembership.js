import { api } from "./auth.js";
import { getSupabase } from "./supabase.js";

async function billingRequest(path, options = {}) {
  const sessionResult = await getSupabase()?.auth.getSession();
  const token = sessionResult?.data?.session?.access_token;
  if (token) {
    return api(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
    });
  }
  return api(path, options);
}

export async function fetchBillingSummary() {
  return billingRequest("/api/billing/summary");
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
