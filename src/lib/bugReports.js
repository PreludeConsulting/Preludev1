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
  if (!response.ok) throw new Error("Something went wrong sending your report. Please try again.");
  return data;
}
