const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

/** @type {{ accessToken: string|null, expiresAt: number }} */
const tokenCache = {
  accessToken: null,
  expiresAt: 0
};

export function getZoomConfig(env = process.env) {
  return {
    accountId: env.ZOOM_ACCOUNT_ID?.trim() || "",
    clientId: env.ZOOM_CLIENT_ID?.trim() || "",
    clientSecret: env.ZOOM_CLIENT_SECRET?.trim() || "",
    hostUserId: env.ZOOM_USER_ID?.trim() || "me",
    defaultTimezone: env.ZOOM_DEFAULT_TIMEZONE?.trim() || "America/New_York",
    settings: {
      waiting_room: env.ZOOM_MEETING_WAITING_ROOM !== "false",
      join_before_host: env.ZOOM_MEETING_JOIN_BEFORE_HOST === "true",
      host_video: env.ZOOM_MEETING_HOST_VIDEO !== "false",
      participant_video: env.ZOOM_MEETING_PARTICIPANT_VIDEO !== "false",
      mute_upon_entry: env.ZOOM_MEETING_MUTE_UPON_ENTRY !== "false",
      approval_type: 2,
      auto_recording: "none"
    }
  };
}

export function isZoomConfigured(env = process.env) {
  const config = getZoomConfig(env);
  return Boolean(config.accountId && config.clientId && config.clientSecret);
}

function resetTokenCache() {
  tokenCache.accessToken = null;
  tokenCache.expiresAt = 0;
}

function basicAuthHeader(clientId, clientSecret) {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

/**
 * @param {Record<string, string>} [env]
 */
export async function getZoomAccessToken(env = process.env) {
  const config = getZoomConfig(env);
  if (!isZoomConfigured(env)) {
    const error = new Error("Zoom is not configured on the server.");
    error.statusCode = 503;
    error.code = "zoom_not_configured";
    throw error;
  }

  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const url = `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(config.accountId)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[zoom-service] token request failed", {
      status: response.status,
      reason: payload?.reason || payload?.error
    });
    resetTokenCache();
    const error = new Error("Unable to authenticate with Zoom.");
    error.statusCode = 502;
    error.code = "zoom_auth_failed";
    throw error;
  }

  const expiresInMs = Number(payload.expires_in || 3600) * 1000;
  tokenCache.accessToken = payload.access_token;
  tokenCache.expiresAt = now + expiresInMs;
  return tokenCache.accessToken;
}

function formatZoomStartTime(isoStartTime) {
  const date = new Date(isoStartTime);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("Invalid meeting start time.");
    error.statusCode = 400;
    throw error;
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function computeDurationMinutes(startTime, endTime, explicitDuration) {
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
    return Math.min(Math.max(Math.round(explicitDuration), 15), 480);
  }
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return Math.min(Math.max(diffMinutes || 60, 15), 480);
}

/**
 * @typedef {object} CreateZoomMeetingInput
 * @property {string} topic
 * @property {string} startTime ISO-8601
 * @property {string} [endTime]
 * @property {number} [duration]
 * @property {string} [timezone]
 * @property {string} [agenda]
 */

/**
 * @param {CreateZoomMeetingInput} input
 * @param {Record<string, string>} [env]
 */
export async function createZoomMeeting(input, env = process.env) {
  const config = getZoomConfig(env);
  const accessToken = await getZoomAccessToken(env);
  const duration = computeDurationMinutes(input.startTime, input.endTime, input.duration);
  const timezone = input.timezone || config.defaultTimezone;

  const body = {
    topic: input.topic,
    type: 2,
    start_time: formatZoomStartTime(input.startTime),
    duration,
    timezone,
    agenda: input.agenda || undefined,
    settings: {
      ...config.settings,
      timezone
    }
  };

  const response = await fetch(`${ZOOM_API_BASE}/users/${encodeURIComponent(config.hostUserId)}/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[zoom-service] meeting creation failed", {
      status: response.status,
      code: payload?.code,
      message: payload?.message
    });
    const error = new Error("Zoom meeting could not be created.");
    error.statusCode = response.status >= 500 ? 502 : 400;
    error.code = "zoom_meeting_failed";
    throw error;
  }

  return {
    zoomMeetingId: String(payload.id ?? ""),
    joinUrl: payload.join_url || null,
    startUrl: payload.start_url || null,
    password: payload.password || null,
    duration,
    timezone,
    raw: {
      id: payload.id,
      uuid: payload.uuid,
      host_id: payload.host_id,
      start_time: payload.start_time
    }
  };
}

/**
 * Best-effort cleanup when persistence fails after Zoom succeeds.
 * @param {string} zoomMeetingId
 * @param {Record<string, string>} [env]
 */
export async function deleteZoomMeeting(zoomMeetingId, env = process.env) {
  if (!zoomMeetingId) return;
  try {
    const accessToken = await getZoomAccessToken(env);
    await fetch(`${ZOOM_API_BASE}/meetings/${encodeURIComponent(zoomMeetingId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (error) {
    console.error("[zoom-service] failed to delete orphaned meeting", {
      zoomMeetingId,
      message: error?.message
    });
  }
}

/** Test helper */
export function __resetZoomTokenCacheForTests() {
  resetTokenCache();
}
