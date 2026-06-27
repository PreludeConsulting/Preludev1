import { api } from "./auth.js"; // shared authenticated fetch

export async function getDashboardAppData() {
  return api("/api/dashboard/app-data");
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
