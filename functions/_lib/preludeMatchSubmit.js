import {
  GENERIC_RETRY,
  MAX_PRELUDE_MATCH_BODY_BYTES,
  processPreludeMatchSubmission
} from "../../server/lib/preludeMatchSubmit.js";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, handlePreflight, json, requireUser, runtimeFetch } from "./http.js";

function getAdmin(context) {
  const url = context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL || "";
  const serviceRoleKey = context.env?.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export async function handlePreludeMatchSubmit(context) {
  const methods = "POST, OPTIONS";
  if (context.request.method === "OPTIONS") return handlePreflight(context, { methods });
  if (context.request.method !== "POST") {
    return json(
      { success: false, error: "Method not allowed" },
      405,
      { ...corsHeaders(context, { methods }), Allow: "POST" }
    );
  }

  const headers = corsHeaders(context, { methods });

  try {
    const contentLength = Number(context.request.headers.get("content-length") || 0);
    if (contentLength > MAX_PRELUDE_MATCH_BODY_BYTES) {
      return json({ success: false, error: "Payload too large" }, 413, headers);
    }

    const { user } = await requireUser(context);
    if (!user.email) {
      return json({ success: false, error: "Unauthorized" }, 401, headers);
    }

    const rawText = await context.request.text();
    if (rawText.length > MAX_PRELUDE_MATCH_BODY_BYTES) {
      return json({ success: false, error: "Payload too large" }, 413, headers);
    }

    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch {
      return json({ success: false, error: "Invalid Prelude Match submission" }, 400, headers);
    }

    const result = await processPreludeMatchSubmission({
      env: context.env || {},
      user: { id: user.id, email: user.email },
      payload,
      fetchImpl: runtimeFetch(context),
      admin: getAdmin(context)
    });

    return json(result, 200, headers);
  } catch (error) {
    const status = Number(error?.statusCode || error?.status) || 500;
    if (status >= 500) {
      console.error("[prelude-match-submit-worker]", {
        code: error?.code,
        message: error?.message
      });
    }
    const message =
      status >= 500 && error?.code !== "email_not_configured" && error?.code !== "email_domain"
        ? GENERIC_RETRY
        : error?.message || GENERIC_RETRY;
    return json({ success: false, error: message, code: error?.code || "server_error" }, status, headers);
  }
}
