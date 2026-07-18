import { getSupabase } from "./supabase.js";

export async function submitBugReport(payload) {
  const session = await getSupabase()?.auth.getSession();
  const token = session?.data?.session?.access_token;
  const response = await fetch("/api/support/bug-report", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (import.meta.env.DEV) {
      console.error("[prelude-bug-report] submission failed", {
        status: response.status,
        error: data.error,
        message: data.debugMessage || data.message
      });
    }
    const error = new Error(data.debugMessage || data.message || "Something went wrong sending your report. Please try again.");
    error.status = response.status;
    error.code = data.error;
    throw error;
  }
  return data;
}
