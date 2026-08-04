/**
 * Pure helpers for Prelude Match submission (validation + email formatting).
 * Safe for browser, Node tests, Deno Edge Functions, and Cloudflare Workers.
 */
import {
  EXPLORE_COLLEGE_CATALOG,
  EXPLORE_COLLEGE_IDS,
  getExploreCollegeById
} from "./exploreCollegesCatalog.js";

export const PRELUDE_MATCH_FORM_VERSION = "prelude-match-v1";
export const STILL_EXPLORING_LABEL = "Still exploring";
export const MAX_PRELUDE_MATCH_BODY_BYTES = 80_000;
export const MAX_OPEN_RESPONSE_LENGTH = 4_000;
export const MAX_DISPLAY_NAME_LENGTH = 120;
export const MAX_MULTI_SELECT = 20;

export { EXPLORE_COLLEGE_CATALOG, EXPLORE_COLLEGE_IDS, getExploreCollegeById };

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export function formatCollegeLocation(college) {
  if (!college) return "";
  if (college.city && college.state) return `${college.city}, ${college.state}`;
  return college.city || college.state || "";
}

/** Normalize colleges answer into { stillExploring, collegeIds } for the wire payload. */
export function serializeCollegesAnswer(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { stillExploring: false, collegeIds: [] };
  }
  if (
    raw.length === 1 &&
    (raw[0] === STILL_EXPLORING_LABEL || raw[0]?.name === STILL_EXPLORING_LABEL)
  ) {
    return { stillExploring: true, collegeIds: [] };
  }
  const ids = [];
  const seen = new Set();
  for (const item of raw) {
    if (item === STILL_EXPLORING_LABEL || item?.name === STILL_EXPLORING_LABEL) continue;
    const id = typeof item === "string" ? item : item?.id;
    if (!id || !EXPLORE_COLLEGE_IDS.has(String(id)) || seen.has(String(id))) continue;
    seen.add(String(id));
    ids.push(String(id));
  }
  return { stillExploring: false, collegeIds: ids };
}

export function resolveCollegeIds(collegeIds = []) {
  const resolved = [];
  const seen = new Set();
  for (const id of collegeIds) {
    const key = String(id || "");
    if (!key || seen.has(key)) continue;
    const college = getExploreCollegeById(key);
    if (!college) return { ok: false, error: "unknown_college", collegeIds: [] };
    seen.add(key);
    resolved.push(college);
  }
  return { ok: true, colleges: resolved };
}

export function buildPreludeMatchPayload({
  answers,
  submissionId,
  studentDisplayName = "",
  timezone = "",
  submittedAt = new Date().toISOString(),
  questions
} = {}) {
  const colleges = serializeCollegesAnswer(answers?.colleges);
  const answerPayload = { ...(answers || {}) };
  delete answerPayload.colleges;
  return {
    submissionId,
    formVersion: PRELUDE_MATCH_FORM_VERSION,
    submittedAt,
    timezone: timezone || undefined,
    studentDisplayName: studentDisplayName || undefined,
    answers: {
      ...answerPayload,
      colleges
    },
    // Question order hint for email formatting (ids only; text resolved server-side from shared config)
    questionOrder: Array.isArray(questions) ? questions.map((q) => q.id) : undefined
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Server-side validation. Does not trust browser userId/email.
 * `questionDefs` should be the full PRELUDE_MATCH_QUESTIONS list (or a Deno-safe copy).
 */
export function validatePreludeMatchPayload(payload, questionDefs = []) {
  if (!isPlainObject(payload)) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (payload.formVersion !== PRELUDE_MATCH_FORM_VERSION) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (!isUuid(payload.submissionId)) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (!payload.submittedAt || Number.isNaN(Date.parse(payload.submittedAt))) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (payload.timezone != null && (typeof payload.timezone !== "string" || payload.timezone.length > 80)) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (
    payload.studentDisplayName != null &&
    (typeof payload.studentDisplayName !== "string" ||
      payload.studentDisplayName.length > MAX_DISPLAY_NAME_LENGTH)
  ) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (!isPlainObject(payload.answers)) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }

  const answers = payload.answers;
  const byId = new Map(questionDefs.map((q) => [q.id, q]));

  // Reject unexpected top-level answer keys beyond known questions + colleges shape
  for (const key of Object.keys(answers)) {
    if (key === "colleges") continue;
    if (!byId.has(key)) {
      return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
    }
  }

  const colleges = answers.colleges;
  if (!isPlainObject(colleges)) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (typeof colleges.stillExploring !== "boolean" || !Array.isArray(colleges.collegeIds)) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (colleges.stillExploring && colleges.collegeIds.length > 0) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (!colleges.stillExploring && colleges.collegeIds.length === 0) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  if (colleges.collegeIds.length > 85) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  const uniqueIds = new Set(colleges.collegeIds.map(String));
  if (uniqueIds.size !== colleges.collegeIds.length) {
    return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
  }
  for (const id of colleges.collegeIds) {
    if (typeof id !== "string" || !EXPLORE_COLLEGE_IDS.has(id)) {
      return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
    }
  }

  for (const question of questionDefs) {
    if (question.id === "colleges") continue;
    const value = answers[question.id];
    if (value == null) continue;

    if (question.type === "single-select") {
      if (typeof value !== "string" || value.length > 200) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
      if (question.options && !question.options.includes(value)) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
    } else if (question.type === "multi-select") {
      if (!Array.isArray(value) || value.length > MAX_MULTI_SELECT) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
      for (const entry of value) {
        if (typeof entry !== "string" || entry.length > 200) {
          return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
        }
        if (question.options && !question.options.includes(entry)) {
          return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
        }
      }
      if (question.maxChoices && value.length > question.maxChoices) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
    } else if (question.type === "open-response") {
      if (typeof value !== "string" || value.length > MAX_OPEN_RESPONSE_LENGTH) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
    } else if (question.type === "name-fields") {
      if (!isPlainObject(value)) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
      const firstName = value.firstName;
      const lastName = value.lastName;
      if (typeof firstName !== "string" || typeof lastName !== "string") {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
      if (!firstName.trim() || !lastName.trim() || firstName.length > 80 || lastName.length > 80) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
    } else if (question.type === "scale") {
      const min = question.scale?.min ?? 1;
      const max = question.scale?.max ?? 5;
      if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
    }
  }

  // Required always-visible questions must be present when required
  const requiredAlways = questionDefs.filter((q) => q.required && !q.showWhen);
  for (const question of requiredAlways) {
    if (question.id === "colleges") continue;
    const value = answers[question.id];
    if (question.type === "name-fields") {
      const firstName = typeof value?.firstName === "string" ? value.firstName.trim() : "";
      const lastName = typeof value?.lastName === "string" ? value.lastName.trim() : "";
      if (!firstName || !lastName) {
        return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
      }
      continue;
    }
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
      return { ok: false, status: 400, error: "Invalid Prelude Match submission" };
    }
  }

  return { ok: true };
}

function formatAnswerLines(question, answers) {
  if (question.id === "colleges") {
    const colleges = answers.colleges || {};
    if (colleges.stillExploring) return ["Still exploring"];
    const resolved = resolveCollegeIds(colleges.collegeIds || []);
    if (!resolved.ok || !resolved.colleges?.length) return ["No answer provided"];
    return resolved.colleges.flatMap((college) => [
      college.name,
      formatCollegeLocation(college)
    ]);
  }

  const value = answers[question.id];
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return ["No answer provided"];
  }
  if (question.type === "name-fields" && isPlainObject(value)) {
    const firstName = String(value.firstName || "").trim();
    const lastName = String(value.lastName || "").trim();
    if (!firstName && !lastName) return ["No answer provided"];
    return [`${firstName} ${lastName}`.trim()];
  }
  if (Array.isArray(value)) return value.map(String);
  if (question.type === "scale") {
    return [`${value} (1 = ${question.scale?.lowLabel || "Low"}, 5 = ${question.scale?.highLabel || "High"})`];
  }
  return [String(value)];
}

export function buildPreludeMatchEmail({
  payload,
  questionDefs,
  verifiedUserId,
  verifiedEmail,
  notificationEmail
}) {
  const displayName =
    (payload.studentDisplayName && String(payload.studentDisplayName).trim()) ||
    verifiedEmail ||
    "Student";
  const subject = `New Prelude Match Submission — ${displayName}`;
  const submitted = new Date(payload.submittedAt);
  const dateLabel = submitted.toISOString().slice(0, 10);
  const timeLabel = submitted.toISOString().slice(11, 19) + " UTC";
  const tz = payload.timezone || "Not provided";

  const sections = questionDefs.map((question) => ({
    question: question.question,
    lines: formatAnswerLines(question, payload.answers)
  }));

  const textParts = [
    "New Prelude Match submission",
    "",
    "Student information",
    `Student display name: ${displayName}`,
    `Authenticated email: ${verifiedEmail}`,
    `Authenticated Supabase user ID: ${verifiedUserId}`,
    `Submission date: ${dateLabel}`,
    `Submission time: ${timeLabel}`,
    `Submitted time zone: ${tz}`,
    `Submission-attempt ID: ${payload.submissionId}`,
    ""
  ];

  for (const section of sections) {
    textParts.push(`Question:`, section.question, "", "Answer:");
    for (const line of section.lines) textParts.push(`- ${line}`);
    textParts.push("");
  }

  const htmlSections = sections
    .map((section) => {
      const answerHtml = section.lines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");
      return `<section style="margin:0 0 1.25rem;">
  <p style="margin:0 0 0.25rem;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">Question</p>
  <p style="margin:0 0 0.65rem;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(section.question)}</p>
  <p style="margin:0 0 0.25rem;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">Answer</p>
  <ul style="margin:0;padding-left:1.1rem;color:#111827;font-size:14px;line-height:1.5;">${answerHtml}</ul>
</section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
    <tr><td style="padding:24px;">
      <p style="margin:0 0 0.35rem;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Prelude Match</p>
      <h1 style="margin:0 0 1rem;font-size:22px;line-height:1.3;">New Prelude Match Submission</h1>
      <section style="margin:0 0 1.5rem;padding:1rem;background:#f9fafb;border-radius:10px;">
        <p style="margin:0 0 0.35rem;"><strong>Student display name:</strong> ${escapeHtml(displayName)}</p>
        <p style="margin:0 0 0.35rem;"><strong>Authenticated email:</strong> ${escapeHtml(verifiedEmail)}</p>
        <p style="margin:0 0 0.35rem;"><strong>Authenticated Supabase user ID:</strong> ${escapeHtml(verifiedUserId)}</p>
        <p style="margin:0 0 0.35rem;"><strong>Submission date:</strong> ${escapeHtml(dateLabel)}</p>
        <p style="margin:0 0 0.35rem;"><strong>Submission time:</strong> ${escapeHtml(timeLabel)}</p>
        <p style="margin:0 0 0.35rem;"><strong>Submitted time zone:</strong> ${escapeHtml(tz)}</p>
        <p style="margin:0;"><strong>Submission-attempt ID:</strong> ${escapeHtml(payload.submissionId)}</p>
      </section>
      ${htmlSections}
      <p style="margin:1.5rem 0 0;font-size:12px;color:#6b7280;">Internal recipient: ${escapeHtml(notificationEmail)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject,
    text: textParts.join("\n"),
    html
  };
}

/**
 * Convert validated wire answers into the shape used by admin matching UI
 * (`questionnaire_answers` on onboarding_progress).
 */
export function toDisplayQuestionnaireAnswers(wireAnswers = {}) {
  const display = { ...(wireAnswers || {}) };
  const colleges = wireAnswers?.colleges;
  if (colleges && typeof colleges === "object" && !Array.isArray(colleges)) {
    if (colleges.stillExploring) {
      display.colleges = [STILL_EXPLORING_LABEL];
    } else {
      const resolved = resolveCollegeIds(colleges.collegeIds || []);
      display.colleges = resolved.ok
        ? resolved.colleges.map((college) => ({
            id: college.id,
            name: college.name,
            city: college.city || "",
            state: college.state || ""
          }))
        : [];
    }
  }
  return display;
}

/**
 * Resolve Resend config from Cloudflare / Node / Edge env.
 * Prefers the documented names; falls back to legacy Match + auth sender vars.
 */
export function resolvePreludeMatchEmailConfig(env = {}) {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const toEmail = String(
    env.PRELUDE_MATCH_RECIPIENT ||
      env.PRELUDE_MATCH_NOTIFICATION_EMAIL ||
      "prelude@preludeconsultingllc.com"
  ).trim();
  const fromEmail = String(
    env.PRELUDE_FROM_EMAIL || env.PRELUDE_MATCH_FROM_EMAIL || env.AUTH_EMAIL_FROM || ""
  ).trim();
  return {
    apiKey,
    toEmail,
    fromEmail,
    configured: Boolean(apiKey && toEmail && fromEmail)
  };
}
