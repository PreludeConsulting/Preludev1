/**
 * Deno/Supabase Edge Function: email-only Prelude Match submission via Resend.
 * Zero database writes. Zero Storage uploads.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PRELUDE_MATCH_QUESTIONS } from "../../../shared/preludeMatchQuestions.js";
import {
  MAX_PRELUDE_MATCH_BODY_BYTES,
  buildPreludeMatchEmail,
  validatePreludeMatchPayload
} from "../../../shared/preludeMatchSubmission.js";

const ALLOWED_ORIGINS = new Set([
  "https://preludeconsultingllc.com",
  "https://www.preludeconsultingllc.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { success: false, error: "Method not allowed" }, 405);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_PRELUDE_MATCH_BODY_BYTES) {
    return json(req, { success: false, error: "Payload too large" }, 413);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(req, { success: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[send-prelude-match] missing supabase env");
    return json(req, { success: false, error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.id || !user.email) {
    return json(req, { success: false, error: "Unauthorized" }, 401);
  }

  let rawText = "";
  try {
    rawText = await req.text();
  } catch {
    return json(req, { success: false, error: "Invalid Prelude Match submission" }, 400);
  }
  if (rawText.length > MAX_PRELUDE_MATCH_BODY_BYTES) {
    return json(req, { success: false, error: "Payload too large" }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return json(req, { success: false, error: "Invalid Prelude Match submission" }, 400);
  }

  // Ignore any browser-supplied identity fields.
  if (payload && typeof payload === "object") {
    delete payload.userId;
    delete payload.authenticatedEmail;
    delete payload.email;
    delete payload.authUserId;
  }

  const validation = validatePreludeMatchPayload(payload, PRELUDE_MATCH_QUESTIONS);
  if (!validation.ok) {
    console.error("[send-prelude-match] validation_failed", {
      submissionId: payload?.submissionId || null,
      userId: user.id,
      status: validation.status
    });
    return json(req, { success: false, error: validation.error }, validation.status || 400);
  }

  const resendKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const toEmail = (Deno.env.get("PRELUDE_MATCH_NOTIFICATION_EMAIL") || "").trim();
  const fromEmail = (Deno.env.get("PRELUDE_MATCH_FROM_EMAIL") || "").trim();
  if (!resendKey || !toEmail || !fromEmail) {
    console.error("[send-prelude-match] missing_email_secrets");
    return json(req, { success: false, error: "Email delivery is not configured" }, 500);
  }

  const email = buildPreludeMatchEmail({
    payload,
    questionDefs: PRELUDE_MATCH_QUESTIONS,
    verifiedUserId: user.id,
    verifiedEmail: user.email,
    notificationEmail: toEmail
  });

  const idempotencyKey = `prelude-match/${user.id}/${payload.submissionId}`;

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: email.subject,
        html: email.html,
        text: email.text
      })
    });
  } catch {
    console.error("[send-prelude-match] provider_network_error", {
      submissionId: payload.submissionId,
      userId: user.id
    });
    return json(req, { success: false, error: "Email provider unavailable" }, 502);
  }

  if (providerResponse.status === 429) {
    return json(req, { success: false, error: "Too many requests. Please try again shortly." }, 429);
  }

  if (!providerResponse.ok) {
    const category =
      providerResponse.status === 403
        ? "domain_or_authorization"
        : providerResponse.status >= 500
          ? "provider_server"
          : "provider_rejected";
    console.error("[send-prelude-match] provider_error", {
      submissionId: payload.submissionId,
      userId: user.id,
      status: providerResponse.status,
      category
    });
    const message =
      providerResponse.status === 403
        ? "Email could not be sent. The sending domain may not be verified in Resend."
        : "We couldn’t submit your Prelude Match responses. Please try again.";
    return json(req, { success: false, error: message }, providerResponse.status >= 500 ? 502 : 500);
  }

  const providerBody = await providerResponse.json().catch(() => ({}));
  console.log("[send-prelude-match] accepted", {
    submissionId: payload.submissionId,
    userId: user.id,
    status: providerResponse.status
  });

  return json(req, {
    success: true,
    submissionId: payload.submissionId,
    emailId: providerBody?.id || null
  });
});
