import { api } from "./auth.js"; // shared authenticated fetch
import { getSupabase } from "./supabase.js";

async function dashboardRequest(path, options = {}) {
  const sessionResult = await getSupabase()?.auth.getSession();
  const token = sessionResult?.data?.session?.access_token;
  if (!token) return api(path, options);
  return api(path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
}

export async function getDashboardAppData() {
  return dashboardRequest("/api/dashboard/app-data");
}

export async function updateDashboardProfile(fields) {
  return dashboardRequest("/api/dashboard/profile", { method: "PATCH", body: JSON.stringify(fields) });
}

export async function updateDashboardSettings(fields) {
  return dashboardRequest("/api/dashboard/settings", { method: "PATCH", body: JSON.stringify(fields) });
}

export async function updateMentorAvailability(availability) {
  return dashboardRequest("/api/dashboard/availability", { method: "PUT", body: JSON.stringify(availability) });
}

export async function getMeetings() {
  return api("/api/meetings");
}

export async function createMeeting(payload, options = {}) {
  const headers = {};
  const idempotencyKey = options.idempotencyKey || payload.clientRequestId || payload.idempotencyKey;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return api("/api/meetings", {
    method: "POST",
    body: JSON.stringify(payload),
    headers
  });
}

export async function getAvailableMentorSlots(mentorUserId) {
  const params = new URLSearchParams({ mentorUserId: String(mentorUserId) });
  return dashboardRequest(`/api/meetings/available-slots?${params.toString()}`);
}

export async function updateMeeting(id, payload) {
  return api(`/api/meetings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function getIntegrations() {
  return api("/api/integrations");
}

export async function connectGoogleCalendar() {
  return api("/api/integrations/google-calendar/connect", { method: "POST" });
}

export async function disconnectGoogleCalendar() {
  return api("/api/integrations/google-calendar/disconnect", { method: "POST" });
}

export async function connectZoom() {
  return api("/api/integrations/zoom/connect", { method: "POST" });
}

export async function disconnectZoom() {
  return api("/api/integrations/zoom/disconnect", { method: "POST" });
}
