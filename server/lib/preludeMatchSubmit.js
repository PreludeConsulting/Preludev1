/**
 * Prelude Match submission: validate → persist → email via Resend.
 * Shared by Cloudflare Pages Functions and the local/Node API stack.
 * Do not import Node-only modules (node:crypto / loginAssurance) — CF Pages bundles this file.
 */
import { createClient } from "@supabase/supabase-js";
import { PRELUDE_MATCH_QUESTIONS } from "../../shared/preludeMatchQuestions.js";
import {
  MAX_PRELUDE_MATCH_BODY_BYTES,
  buildPreludeMatchEmail,
  resolvePreludeMatchEmailConfig,
  toDisplayQuestionnaireAnswers,
  validatePreludeMatchPayload
} from "../../shared/preludeMatchSubmission.js";

const MATCH_COMPLETED_STATUS = "match_completed";

const GENERIC_RETRY =
  "We couldn’t submit your Prelude Match responses. Your answers are still here—please try again.";

function getDefaultAdmin() {
  const url = (typeof process !== "undefined" && (process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL)) || "";
  const key = (typeof process !== "undefined" && process.env?.SUPABASE_SERVICE_ROLE_KEY) || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function httpError(message, statusCode = 500, code = "server_error", details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function sanitizePayloadIdentity(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const next = { ...payload };
  delete next.userId;
  delete next.authenticatedEmail;
  delete next.email;
  delete next.authUserId;
  return next;
}

async function sendResendEmail({ apiKey, fromEmail, toEmail, email, idempotencyKey, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
  } catch (error) {
    return {
      ok: false,
      status: 0,
      reason: "provider_network_error",
      providerMessage: error?.message || "network_error"
    };
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      reason:
        response.status === 403
          ? "domain_or_authorization"
          : response.status === 429
            ? "rate_limited"
            : response.status >= 500
              ? "provider_server"
              : "provider_rejected",
      providerMessage: body?.message || body?.error?.message || `status_${response.status}`,
      providerBody: body
    };
  }

  return { ok: true, status: response.status, id: body?.id || null };
}

async function upsertSubmissionRow(admin, row) {
  const { data, error } = await admin
    .from("prelude_match_submissions")
    .upsert(row, { onConflict: "submission_id" })
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[prelude-match-submit] db_upsert_failed", {
      code: error.code,
      message: error.message,
      submissionId: row.submission_id,
      userId: row.user_id
    });
    throw httpError("Could not save your Prelude Match responses. Please try again.", 503, "database_error");
  }
  return data;
}

async function markOnboardingComplete(admin, { userId, answers }) {
  const payload = {
    user_id: userId,
    questionnaire_answers: toDisplayQuestionnaireAnswers(answers),
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
  };

  const { error } = await admin.from("onboarding_progress").upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.error("[prelude-match-submit] onboarding_upsert_failed", {
      code: error.code,
      message: error.message,
      userId
    });
    throw httpError("Responses were recorded, but onboarding could not be updated. Please try again.", 503, "onboarding_error");
  }
}

/**
 * @param {object} params
 * @param {object} params.env
 * @param {{ id: string, email?: string }} params.user
 * @param {object} params.payload
 * @param {typeof fetch} [params.fetchImpl]
 * @param {import("@supabase/supabase-js").SupabaseClient | null} [params.admin]
 */
export async function processPreludeMatchSubmission({
  env,
  user,
  payload: rawPayload,
  fetchImpl = fetch,
  admin = getDefaultAdmin()
}) {
  if (!user?.id || !user?.email) {
    throw httpError("Authentication required.", 401, "unauthenticated");
  }

  const payload = sanitizePayloadIdentity(rawPayload);
  const validation = validatePreludeMatchPayload(payload, PRELUDE_MATCH_QUESTIONS);
  if (!validation.ok) {
    console.error("[prelude-match-submit] validation_failed", {
      submissionId: payload?.submissionId || null,
      userId: user.id,
      status: validation.status
    });
    throw httpError(validation.error || "Invalid Prelude Match submission", validation.status || 400, "validation_error");
  }

  const emailConfig = resolvePreludeMatchEmailConfig(env);
  if (!emailConfig.configured) {
    console.error("[prelude-match-submit] missing_email_secrets", {
      hasResendKey: Boolean(emailConfig.apiKey),
      hasFrom: Boolean(emailConfig.fromEmail),
      hasTo: Boolean(emailConfig.toEmail)
    });
    throw httpError("Email delivery is not configured. Please contact Prelude support.", 500, "email_not_configured");
  }

  if (!admin) {
    console.error("[prelude-match-submit] missing_service_role");
    throw httpError("Server configuration error.", 503, "service_unavailable");
  }

  const { data: existing, error: existingError } = await admin
    .from("prelude_match_submissions")
    .select("*")
    .eq("submission_id", payload.submissionId)
    .maybeSingle();

  if (existingError) {
    console.error("[prelude-match-submit] db_lookup_failed", {
      code: existingError.code,
      message: existingError.message,
      submissionId: payload.submissionId,
      userId: user.id
    });
    throw httpError("Could not save your Prelude Match responses. Please try again.", 503, "database_error");
  }

  if (existing && existing.user_id !== user.id) {
    throw httpError("Invalid Prelude Match submission", 400, "validation_error");
  }

  if (existing?.email_status === "sent") {
    await markOnboardingComplete(admin, { userId: user.id, answers: existing.answers || payload.answers });
    return {
      success: true,
      submissionId: payload.submissionId,
      emailId: existing.email_provider_message_id || null,
      emailStatus: "sent",
      alreadySubmitted: true
    };
  }

  const baseRow = {
    submission_id: payload.submissionId,
    user_id: user.id,
    student_email: user.email,
    student_display_name: payload.studentDisplayName || null,
    answers: payload.answers,
    form_version: payload.formVersion,
    submitted_at: payload.submittedAt,
    timezone: payload.timezone || null,
    email_status: "pending",
    email_provider_message_id: null,
    email_failure_reason: null,
    updated_at: new Date().toISOString()
  };

  const saved = await upsertSubmissionRow(admin, baseRow);

  const email = buildPreludeMatchEmail({
    payload,
    questionDefs: PRELUDE_MATCH_QUESTIONS,
    verifiedUserId: user.id,
    verifiedEmail: user.email,
    notificationEmail: emailConfig.toEmail
  });

  const idempotencyKey = `prelude-match/${user.id}/${payload.submissionId}`;
  const provider = await sendResendEmail({
    apiKey: emailConfig.apiKey,
    fromEmail: emailConfig.fromEmail,
    toEmail: emailConfig.toEmail,
    email,
    idempotencyKey,
    fetchImpl
  });

  if (!provider.ok) {
    const failureReason = `${provider.reason}:${provider.providerMessage || "unknown"}`.slice(0, 500);
    await upsertSubmissionRow(admin, {
      ...baseRow,
      id: saved?.id,
      email_status: "failed",
      email_failure_reason: failureReason,
      updated_at: new Date().toISOString()
    }).catch((err) => {
      console.error("[prelude-match-submit] failed_status_update_error", {
        message: err?.message,
        submissionId: payload.submissionId,
        userId: user.id
      });
    });

    console.error("[prelude-match-submit] provider_error", {
      submissionId: payload.submissionId,
      userId: user.id,
      status: provider.status,
      reason: provider.reason
    });

    if (provider.status === 429) {
      throw httpError("Too many requests. Please try again shortly.", 429, "rate_limited");
    }
    if (provider.reason === "domain_or_authorization") {
      throw httpError(
        "Email could not be sent. The sending domain may not be verified in Resend.",
        500,
        "email_domain"
      );
    }
    if (provider.reason === "provider_network_error" || provider.reason === "provider_server") {
      throw httpError("Email provider unavailable", 502, "email_provider_unavailable");
    }
    throw httpError(GENERIC_RETRY, 500, "email_failed");
  }

  await upsertSubmissionRow(admin, {
    ...baseRow,
    id: saved?.id,
    email_status: "sent",
    email_provider_message_id: provider.id,
    email_failure_reason: null,
    updated_at: new Date().toISOString()
  });
  await markOnboardingComplete(admin, { userId: user.id, answers: payload.answers });

  console.log("[prelude-match-submit] accepted", {
    submissionId: payload.submissionId,
    userId: user.id,
    emailId: provider.id || null
  });

  return {
    success: true,
    submissionId: payload.submissionId,
    emailId: provider.id || null,
    emailStatus: "sent",
    alreadySubmitted: false
  };
}

export function assertPreludeMatchBodySize(rawText = "") {
  if (String(rawText).length > MAX_PRELUDE_MATCH_BODY_BYTES) {
    throw httpError("Payload too large", 413, "payload_too_large");
  }
}

export { MAX_PRELUDE_MATCH_BODY_BYTES, GENERIC_RETRY };
