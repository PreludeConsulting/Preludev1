import { sendBugReport } from "../../server/lib/bugReports.js";
import { enforceIpRateLimit } from "../../server/lib/ipRateLimit.js";

const REPORT_LIMIT = 5;
const REPORT_WINDOW_SECONDS = 60 * 60;

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
  });
}

function nodeLikeRequest(request) {
  const url = new URL(request.url);
  return {
    headers: {
      "x-forwarded-for": request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "",
      host: url.host
    }
  };
}

function isDevelopment(env) {
  return env?.NODE_ENV === "development" || env?.ENVIRONMENT === "development";
}

async function verifiedAccount(context) {
  const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL;
  const key = context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_PUBLISHABLE_KEY || context.env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const baseUrl = url.replace(/\/$/, "");
  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${baseUrl}/auth/v1/user`, { headers });
  const user = await userResponse.json().catch(() => null);
  if (!userResponse.ok || !user?.id) return null;

  const profileResponse = await fetch(`${baseUrl}/rest/v1/profiles?select=full_name,role&id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers });
  const profiles = await profileResponse.json().catch(() => []);
  const profile = profileResponse.ok && Array.isArray(profiles) ? profiles[0] : null;
  return {
    name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
    email: user.email || "",
    role: profile?.role || user.user_metadata?.role || "",
    userId: user.id
  };
}

export async function handleBugReport(context) {
  if (context.request.method === "OPTIONS") return json({}, 204);
  if (context.request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });

  const rateLimitError = enforceIpRateLimit(nodeLikeRequest(context.request), "/api/support/bug-report", REPORT_LIMIT, REPORT_WINDOW_SECONDS, context.env);
  if (rateLimitError) {
    return json({ error: "rate_limited", message: "Too many reports. Please wait and try again." }, 429, {
      "Retry-After": String(rateLimitError.retryAfterSeconds)
    });
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "validation_error", message: "Please check the required fields." }, 400);
  }

  try {
    const result = await sendBugReport({ env: context.env, payload, verifiedAccount: await verifiedAccount(context) });
    return json(result);
  } catch (error) {
    if (error?.name === "ZodError") {
      const response = { error: "validation_error", message: "Please check the required fields." };
      if (isDevelopment(context.env)) response.debugMessage = error.issues?.map((issue) => issue.message).join("; ");
      return json(response, 400);
    }
    console.error("[prelude-bug-report-worker]", {
      code: error?.code,
      message: error?.message,
      details: error?.details
    });
    const response = { error: error?.code || "server_error", message: "Something went wrong sending your report. Please try again." };
    if (isDevelopment(context.env)) response.debugMessage = error?.details?.providerMessage || error?.message || "Unknown server error.";
    return json(response, error?.statusCode || 500);
  }
}
