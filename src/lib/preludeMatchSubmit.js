import { getSupabase } from "./supabase.js";
import { PRELUDE_MATCH_QUESTIONS } from "../data/preludeMatchQuestions.js";
import { buildPreludeMatchPayload } from "../../shared/preludeMatchSubmission.js";

const SUBMISSION_ID_KEY = "prelude_match_submission_attempt_id";

export function readPreludeMatchSubmissionId() {
  try {
    return sessionStorage.getItem(SUBMISSION_ID_KEY) || "";
  } catch {
    return "";
  }
}

export function ensurePreludeMatchSubmissionId() {
  const existing = readPreludeMatchSubmissionId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(SUBMISSION_ID_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
  return id;
}

export function clearPreludeMatchSubmissionId() {
  try {
    sessionStorage.removeItem(SUBMISSION_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function buildPreludeMatchClientPayload(answers, { studentDisplayName = "", timezone = "" } = {}) {
  return buildPreludeMatchPayload({
    answers,
    submissionId: ensurePreludeMatchSubmissionId(),
    studentDisplayName,
    timezone:
      timezone ||
      (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""),
    submittedAt: new Date().toISOString(),
    questions: PRELUDE_MATCH_QUESTIONS
  });
}

/**
 * Invoke the send-prelude-match Edge Function. Does not persist answers.
 */
export async function submitPreludeMatchByEmail(answers, { studentDisplayName = "" } = {}) {
  const supabase = getSupabase();
  if (!supabase) {
    const error = new Error("Supabase is not configured.");
    error.code = "supabase_missing";
    throw error;
  }

  const payload = buildPreludeMatchClientPayload(answers, { studentDisplayName });
  const { data, error } = await supabase.functions.invoke("send-prelude-match", {
    body: payload
  });

  if (error) {
    let serverMessage = "";
    try {
      if (typeof error.context?.json === "function") {
        const body = await error.context.json();
        serverMessage = body?.error || "";
      }
    } catch {
      serverMessage = "";
    }
    const err = new Error(
      serverMessage ||
        "We couldn’t submit your Prelude Match responses. Your answers are still here—please try again."
    );
    err.code = "invoke_failed";
    err.cause = error;
    throw err;
  }

  if (!data || data.success !== true) {
    const err = new Error(
      "We couldn’t submit your Prelude Match responses. Your answers are still here—please try again."
    );
    err.code = "provider_rejected";
    err.payload = data;
    throw err;
  }

  clearPreludeMatchSubmissionId();
  return data;
}
