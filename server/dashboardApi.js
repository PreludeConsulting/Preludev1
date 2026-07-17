import { z } from "zod";
import { formatAuthApiError, logAuthApiError } from "./lib/dbErrors.js";
import {
  listMeetingsForUser,
  sanitizeMeetingForRole
} from "./lib/meetingStore.js";
import { scheduleMeeting, updateScheduledMeeting } from "./lib/meetingSchedule.js";
import { readJsonBody, requireAuth, sendJson } from "./authApi.js";

function readIntegrations(userId) {
  const key = `prelude_integrations_${userId}`;
  if (!globalThis.__preludeIntegrations) globalThis.__preludeIntegrations = new Map();
  if (!globalThis.__preludeIntegrations.has(key)) {
    globalThis.__preludeIntegrations.set(key, {
      googleCalendar: { connected: false, connectedAt: null },
      zoom: { connected: false, connectedAt: null }
    });
  }
  return globalThis.__preludeIntegrations.get(key);
}

function writeIntegrations(userId, data) {
  const key = `prelude_integrations_${userId}`;
  if (!globalThis.__preludeIntegrations) globalThis.__preludeIntegrations = new Map();
  globalThis.__preludeIntegrations.set(key, data);
}

function isDashboardPath(pathname) {
  return (
    pathname.startsWith("/api/meetings") ||
    pathname.startsWith("/api/integrations") ||
    pathname === "/api/dashboard/app-data"
  );
}

export function createDashboardApiMiddleware(getSession) {
  return async function dashboardApi(req, res, next) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (!isDashboardPath(url.pathname)) return next();

    const session = await getSession(req);
    if (!session?.user) {
      return sendJson(res, 401, { error: "unauthenticated", message: "Authentication required." });
    }

    const user = session.user;
    const role = user.role;

    try {
      if (url.pathname === "/api/dashboard/app-data" && req.method === "GET") {
        const storedMeetings = await listMeetingsForUser({ userId: user.id, role });
        const meetings = storedMeetings.map((m) => sanitizeMeetingForRole(m, role));
        let mentorAccess = null;
        if (String(role || "").toUpperCase() === "STUDENT") {
          const { canRequestMentor } = await import("./lib/mentorAccess.js");
          mentorAccess = await canRequestMentor({
            studentId: user.id,
            user,
            meetings: storedMeetings
          });
        }
        return sendJson(res, 200, {
          role,
          user,
          integrations: readIntegrations(user.id),
          meetings,
          notifications: [],
          mentorAccess
        });
      }

      if (url.pathname.startsWith("/api/integrations")) {
        const integrations = readIntegrations(user.id);
        if (url.pathname === "/api/integrations" && req.method === "GET") {
          return sendJson(res, 200, { integrations });
        }
        if (url.pathname === "/api/integrations/google-calendar/connect" && req.method === "POST") {
          return sendJson(res, 501, {
            error: "integration_setup_required",
            message: "Google Calendar OAuth is not configured for this deployment yet.",
            integrations
          });
        }
        if (url.pathname === "/api/integrations/google-calendar/disconnect" && req.method === "POST") {
          integrations.googleCalendar = { connected: false, connectedAt: null };
          writeIntegrations(user.id, integrations);
          return sendJson(res, 200, { integrations });
        }
        if (url.pathname === "/api/integrations/zoom/connect" && req.method === "POST") {
          return sendJson(res, 501, {
            error: "integration_setup_required",
            message: "Zoom account OAuth is not configured for this deployment yet. Meetings still support pasted meeting links.",
            integrations
          });
        }
        if (url.pathname === "/api/integrations/zoom/disconnect" && req.method === "POST") {
          integrations.zoom = { connected: false, connectedAt: null };
          writeIntegrations(user.id, integrations);
          return sendJson(res, 200, { integrations });
        }
      }

      if (url.pathname === "/api/meetings" && req.method === "GET") {
        const stored = await listMeetingsForUser({ userId: user.id, role });
        const meetings = stored.map((m) => sanitizeMeetingForRole(m, role));
        return sendJson(res, 200, { meetings });
      }

      if (url.pathname === "/api/meetings" && req.method === "POST") {
        const body = await readJsonBody(req);
        const record = await scheduleMeeting(body, user, req);
        return sendJson(res, 201, { meeting: sanitizeMeetingForRole(record, role) });
      }

      const meetingId = url.pathname.split("/").filter(Boolean).pop();
      if (url.pathname.startsWith("/api/meetings/") && req.method === "PATCH") {
        const body = await readJsonBody(req);
        const updated = await updateScheduledMeeting(meetingId, body, user);
        return sendJson(res, 200, { meeting: sanitizeMeetingForRole(updated, role) });
      }

      return sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, {
          error: "validation_error",
          message: "Invalid meeting request.",
          issues: error.issues
        });
      }
      const formatted = formatAuthApiError(error);
      logAuthApiError(error, formatted);
      return sendJson(res, formatted.statusCode, {
        error: formatted.error,
        ...(formatted.code ? { code: formatted.code } : {}),
        message: formatted.message
      });
    }
  };
}

export function createDashboardApiHandler() {
  const middleware = createDashboardApiMiddleware(async (req) => {
    try {
      return await requireAuth(req);
    } catch {
      return null;
    }
  });

  return function handler(req, res) {
    return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
  };
}

const dashboardHandler = createDashboardApiHandler();
export default dashboardHandler;
