import { first, json, rest, runAuthenticated } from "./http.js";

export const DEFAULT_INTEGRATIONS = () => ({
  googleCalendar: { connected: false, connectedAt: null },
  zoom: { connected: false, connectedAt: null }
});

export function normalizeIntegrations(value) {
  const base = DEFAULT_INTEGRATIONS();
  if (!value || typeof value !== "object") return base;
  return {
    googleCalendar: {
      connected: Boolean(value.googleCalendar?.connected),
      connectedAt: value.googleCalendar?.connectedAt || null
    },
    zoom: {
      connected: Boolean(value.zoom?.connected),
      connectedAt: value.zoom?.connectedAt || null
    }
  };
}

async function loadIntegrations(context, token, userId) {
  const rows = await rest(
    context,
    token,
    `user_settings?select=integrations&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  return normalizeIntegrations(first(rows)?.integrations);
}

async function saveIntegrations(context, token, userId, integrations) {
  const now = new Date().toISOString();
  const rows = await rest(context, token, "user_settings?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      integrations,
      updated_at: now
    })
  });
  return normalizeIntegrations(first(rows)?.integrations || integrations);
}

export async function handleIntegrations(context, action = "index") {
  return runAuthenticated(context, async ({ user, token }) => {
    const method = context.request.method;
    const integrations = await loadIntegrations(context, token, user.id).catch(() => DEFAULT_INTEGRATIONS());

    if (action === "index" && method === "GET") {
      return json({ integrations });
    }

    if (method !== "POST") return json({ error: "method_not_allowed" }, 405);

    if (action === "google-connect" || action === "zoom-connect") {
      return json(
        {
          error: "integration_setup_required",
          message:
            action === "zoom-connect"
              ? "Zoom account OAuth is not configured for this deployment yet. Meetings still support pasted meeting links."
              : "Google Calendar OAuth is not configured for this deployment yet.",
          integrations
        },
        501
      );
    }

    if (action === "google-disconnect") {
      const next = {
        ...integrations,
        googleCalendar: { connected: false, connectedAt: null }
      };
      const saved = await saveIntegrations(context, token, user.id, next).catch(() => next);
      return json({ integrations: saved });
    }

    if (action === "zoom-disconnect") {
      const next = {
        ...integrations,
        zoom: { connected: false, connectedAt: null }
      };
      const saved = await saveIntegrations(context, token, user.id, next).catch(() => next);
      return json({ integrations: saved });
    }

    return json({ error: "not_found" }, 404);
  });
}
