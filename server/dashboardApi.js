import { formatAuthApiError, logAuthApiError } from "./lib/dbErrors.js";
import {
  createMeeting,
  getMeetingById,
  listMeetingsForUser,
  sanitizeMeetingForRole,
  updateMeeting
} from "./lib/meetings.js";

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

export function createDashboardApiMiddleware(getSession) {
  return async function dashboardApi(req, res, next) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const isMeetings = url.pathname.startsWith("/api/meetings");
    const isIntegrations = url.pathname.startsWith("/api/integrations");
    const isDashBundle = url.pathname === "/api/dashboard/app-data";
    if (!isMeetings && !isIntegrations && !isDashBundle) return next();

    const session = await getSession(req);
    if (!session?.user) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const user = session.user;
    const role = user.role;

    try {
      if (isDashBundle && req.method === "GET") {
        const storedMeetings = listMeetingsForUser({ userId: user.id, role });
        const meetings = storedMeetings.map((m) => sanitizeMeetingForRole(m, role));

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            role,
            user,
            integrations: readIntegrations(user.id),
            meetings,
            notifications: []
          })
        );
        return;
      }

      if (isIntegrations) {
        const integrations = readIntegrations(user.id);
        if (url.pathname === "/api/integrations" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ integrations }));
          return;
        }
        if (url.pathname === "/api/integrations/google-calendar/connect" && req.method === "POST") {
          integrations.googleCalendar = { connected: true, connectedAt: new Date().toISOString() };
          writeIntegrations(user.id, integrations);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ integrations, message: "Google Calendar connected (placeholder)." }));
          return;
        }
        if (url.pathname === "/api/integrations/google-calendar/disconnect" && req.method === "POST") {
          integrations.googleCalendar = { connected: false, connectedAt: null };
          writeIntegrations(user.id, integrations);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ integrations }));
          return;
        }
        if (url.pathname === "/api/integrations/zoom/connect" && req.method === "POST") {
          integrations.zoom = { connected: true, connectedAt: new Date().toISOString() };
          writeIntegrations(user.id, integrations);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ integrations, message: "Zoom connected (placeholder)." }));
          return;
        }
        if (url.pathname === "/api/integrations/zoom/disconnect" && req.method === "POST") {
          integrations.zoom = { connected: false, connectedAt: null };
          writeIntegrations(user.id, integrations);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ integrations }));
          return;
        }
      }

      if (isMeetings) {
        if (url.pathname === "/api/meetings" && req.method === "GET") {
          const stored = listMeetingsForUser({ userId: user.id, role });
          const meetings = stored.map((m) => sanitizeMeetingForRole(m, role));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ meetings }));
          return;
        }

        if (url.pathname === "/api/meetings" && req.method === "POST") {
          const body = JSON.parse(await readBody(req));
          const record = createMeeting({
            ...body,
            mentorUserId: role === "MENTOR" ? user.id : body.mentorUserId,
            studentUserId: role === "STUDENT" ? user.id : body.studentUserId,
            status: body.status || (role === "STUDENT" ? "pending" : "scheduled")
          });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ meeting: sanitizeMeetingForRole(record, role) }));
          return;
        }

        const meetingId = url.pathname.split("/").pop();
        if (url.pathname.startsWith("/api/meetings/") && req.method === "PATCH") {
          const body = JSON.parse(await readBody(req));
          const existing = getMeetingById(meetingId);
          if (!existing) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Meeting not found" }));
            return;
          }
          const updated = updateMeeting(meetingId, body);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ meeting: sanitizeMeetingForRole(updated, role) }));
          return;
        }
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (error) {
      const formatted = formatAuthApiError(error);
      logAuthApiError(error, formatted);
      res.statusCode = formatted.statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: formatted.error, message: formatted.message }));
    }
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
