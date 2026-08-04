/**
 * Deno/Supabase Edge Function: Prelude Match submission via Resend + DB persist.
 * Prefer the Cloudflare route POST /api/prelude-match/submit in production;
 * this function remains for direct invoke compatibility.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PRELUDE_MATCH_QUESTIONS } from "../../../shared/preludeMatchQuestions.js";
import {
  MAX_PRELUDE_MATCH_BODY_BYTES,
  buildPreludeMatchEmail,
  resolvePreludeMatchEmailConfig,
  toDisplayQuestionnaireAnswers,
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

const MATCH_COMPLETED_STATUS = "match_completed";

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

function envBag() {
  return {
    RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") || "",
    PRELUDE_MATCH_RECIPIENT: Deno.env.get("PRELUDE_MATCH_RECIPIENT") || "",
    PRELUDE_MATCH_NOTIFICATION_EMAIL: Deno.env.get("PRELUDE_MATCH_NOTIFICATION_EMAIL") || "",
    PRELUDE_FROM_EMAIL: Deno.env.get("PRELUDE_FROM_EMAIL") || "",
    PRELUDE_MATCH_FROM_EMAIL: Deno.env.get("PRELUDE_MATCH_FROM_EMAIL") || "",
    AUTH_EMAIL_FROM: Deno.env.get("AUTH_EMAIL_FROM") || ""
  };
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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

  const emailConfig = resolvePreludeMatchEmailConfig(envBag());
  if (!emailConfig.configured) {
    console.error("[send-prelude-match] missing_email_secrets", {
      hasResendKey: Boolean(emailConfig.apiKey),
      hasFrom: Boolean(emailConfig.fromEmail),
      hasTo: Boolean(emailConfig.toEmail)
    });
    return json(req, { success: false, error: "Email delivery is not configured" }, 500);
  }

  const admin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

  async function markOnboarding() {
    if (!admin) return;
    const { error } = await admin.from("onboarding_progress").upsert(
      {
        user_id: user.id,
        questionnaire_answers: toDisplayQuestionnaireAnswers(payload.answers),
        mentor_matching_started: true,
        mentor_matching_complete: true,
        prelude_match_completed: true,
        suggested_mentor_id: null,
        matched_mentor_ids: [],
        matched_mentor_count: 0,
        onboarding_status: MATCH_COMPLETED_STATUS,
        match_decision: null,
        selected_mentor_id: null,
        mentor_selection_method: null,
        mentor_assignment_status: null,
        admin_review_required: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.error("[send-prelude-match] onboarding_upsert_failed", {
        code: error.code,
        message: error.message,
        userId: user.id
      });
    }
  }

  async function upsertSubmission(fields) {
    if (!admin) return null;
    const { data, error } = await admin
      .from("prelude_match_submissions")
      .upsert(
        {
          submission_id: payload.submissionId,
          user_id: user.id,
          student_email: user.email,
          student_display_name: payload.studentDisplayName || null,
          answers: payload.answers,
          form_version: payload.formVersion,
          submitted_at: payload.submittedAt,
          timezone: payload.timezone || null,
          ...fields,
          updated_at: new Date().toISOString()
        },
        { onConflict: "submission_id" }
      )
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[send-prelude-match] db_upsert_failed", {
        code: error.code,
        message: error.message,
        submissionId: payload.submissionId,
        userId: user.id
      });
      return null;
    }
    return data;
  }

  if (admin) {
    const { data: existing } = await admin
      .from("prelude_match_submissions")
      .select("*")
      .eq("submission_id", payload.submissionId)
      .maybeSingle();

    if (existing?.email_status === "sent" && existing.user_id === user.id) {
      await markOnboarding();
      return json(req, {
        success: true,
        submissionId: payload.submissionId,
        emailId: existing.email_provider_message_id || null,
        alreadySubmitted: true
      });
    }

    await upsertSubmission({ email_status: "pending", email_failure_reason: null });
  }

  const email = buildPreludeMatchEmail({
    payload,
    questionDefs: PRELUDE_MATCH_QUESTIONS,
    verifiedUserId: user.id,
    verifiedEmail: user.email,
    notificationEmail: emailConfig.toEmail
  });

  const idempotencyKey = `prelude-match/${user.id}/${payload.submissionId}`;

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailConfig.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        from: emailConfig.fromEmail,
        to: [emailConfig.toEmail],
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
    await upsertSubmission({
      email_status: "failed",
      email_failure_reason: "provider_network_error"
    });
    return json(req, { success: false, error: "Email provider unavailable" }, 502);
  }

  if (providerResponse.status === 429) {
    await upsertSubmission({
      email_status: "failed",
      email_failure_reason: "rate_limited"
    });
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
    await upsertSubmission({
      email_status: "failed",
      email_failure_reason: `${category}:status_${providerResponse.status}`
    });
    const message =
      providerResponse.status === 403
        ? "Email could not be sent. The sending domain may not be verified in Resend."
        : "We couldn’t submit your Prelude Match responses. Please try again.";
    return json(req, { success: false, error: message }, providerResponse.status >= 500 ? 502 : 500);
  }

  const providerBody = await providerResponse.json().catch(() => ({}));
  await upsertSubmission({
    email_status: "sent",
    email_provider_message_id: providerBody?.id || null,
    email_failure_reason: null
  });
  await markOnboarding();

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
