import { getSupabase } from "./supabase.js";
import { PRELUDE_MATCH_QUESTIONS } from "../data/preludeMatchQuestions.js";
import { buildPreludeMatchPayload } from "../../shared/preludeMatchSubmission.js";

const SUBMISSION_ID_KEY = "prelude_match_submission_attempt_id";
const GENERIC_RETRY =
  "We couldn’t submit your Prelude Match responses. Your answers are still here—please try again.";

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

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) return null;
  return session.access_token;
}

/**
 * Submit Prelude Match via the secure Cloudflare/Node API route.
 * Persists answers server-side and emails Prelude. Does not clear local answers on failure.
 */
export async function submitPreludeMatchByEmail(answers, { studentDisplayName = "" } = {}) {
  const token = await getAccessToken();
  if (!token) {
    const error = new Error("Sign in to submit Prelude Match.");
    error.code = "unauthenticated";
    throw error;
  }

  const payload = buildPreludeMatchClientPayload(answers, { studentDisplayName });
  const response = await fetch("/api/prelude-match/submit", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success !== true) {
    const err = new Error(data?.error || GENERIC_RETRY);
    err.code = data?.code || "submit_failed";
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  clearPreludeMatchSubmissionId();
  return data;
}
