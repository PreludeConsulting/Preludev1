import crypto from "node:crypto";
import { z } from "zod";
import { readJsonBody, sendJson } from "./http.js";
import { getSupabaseAdmin, requireSupabaseUser } from "./lib/supabaseRequestAuth.js";
import { withApiRateLimit } from "./lib/apiRateLimitMiddleware.js";
import {
  ESSAY_SUPPORT_ACTIVITY_TYPES,
  getReviewCreditBalance,
  isEssaySupportOnlyStudent,
  reserveEssayReviewCredit,
  restoreEssayReviewCreditOnCancel
} from "./lib/reviewCredits.js";
import { getSessionCreditSummary } from "./lib/sessionCredits.js";
import { buildMentorStudentPlanCredits } from "../shared/mentorStudentRoster.js";

export const ACTIVITY_TYPES = [
  "personal_statement",
  "supplemental_essay",
  "additional_essay",
  "activities_list",
  "resume",
  "custom_activity"
];
export const ACTIVITY_STATUSES = ["not_started", "in_progress", "submitted", "needs_revision", "completed"];
export const SUBMISSION_METHODS = ["document_link", "file_upload"];
export const ALLOWED_SUBMISSION_METHODS = ["document_link", "file_upload", "either"];
export const ACTIVE_MENTOR_MATCH_STATUSES = ["assigned", "accepted", "active"];
export const DEFAULT_ACTIVITY_BUCKET = "mentor-activity-submissions";
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;

const UUID_SCHEMA = z.string().uuid();
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

const optionalText = (max) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const essayPromptSchema = z.object({
  promptText: z.string().trim().min(1).max(20000),
  optionalWordLimit: z.coerce.number().int().positive().max(100000).optional().nullable()
}).strict();
const activityCreateSchema = z.object({
  studentId: UUID_SCHEMA,
  activityType: z.enum(ACTIVITY_TYPES),
  title: z.string().trim().min(1).max(180),
  collegeName: optionalText(180),
  essayPrompt: optionalText(20000),
  prompts: z.array(essayPromptSchema).max(50).optional(),
  wordLimit: z.coerce.number().int().positive().max(100000).optional().nullable(),
  instructions: optionalText(20000),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  allowedSubmissionMethod: z.enum(ALLOWED_SUBMISSION_METHODS).default("either")
}).strict();
const activityUpdateSchema = activityCreateSchema.omit({ studentId: true, prompts: true }).partial().strict();
const submissionSchema = z.object({
  submissionMethod: z.enum(SUBMISSION_METHODS),
  documentUrl: optionalText(2048),
  storagePath: optionalText(1024),
  originalFileName: optionalText(255),
  fileMimeType: optionalText(120),
  fileSize: z.coerce.number().int().positive().max(DEFAULT_MAX_FILE_BYTES).optional().nullable(),
  isDraft: z.boolean().default(true)
}).strict();
const feedbackSchema = z.object({
  feedbackText: z.string().trim().min(1).max(10000),
  submissionId: UUID_SCHEMA.optional().nullable()
}).strict();
const reviewSchema = z.object({
  status: z.enum(["needs_revision", "completed"]),
  feedbackText: z.string().trim().max(10000).optional().nullable(),
  submissionId: UUID_SCHEMA.optional().nullable()
}).strict().superRefine((value, context) => {
  if (value.status === "needs_revision" && !value.feedbackText) {
    context.addIssue({ code: "custom", path: ["feedbackText"], message: "Feedback is required when requesting a revision." });
  }
});
const fileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileMimeType: z.string().trim().min(1).max(120),
  fileSize: z.coerce.number().int().positive()
}).strict();
const filePathSchema = z.object({ storagePath: z.string().trim().min(1).max(1024) }).strict();
const fileUrlSchema = z.object({ submissionId: UUID_SCHEMA }).strict();
const promptResponsesSchema = z.object({
  responses: z.array(z.object({
    promptId: UUID_SCHEMA,
    responseText: z.string().max(50000),
    submissionStatus: z.enum(["draft", "submitted"]).default("draft")
  }).strict()).min(1).max(50)
}).strict();

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function throwForQuery(error, fallback = "Database request failed.") {
  if (error) throw httpError(500, fallback, "database_error");
}

export function sanitizeActivityFileName(fileName) {
  const base = String(fileName || "document").split(/[\\/]/).pop() || "document";
  const cleaned = base.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-180);
  return cleaned || "document";
}

export function resolveActivityFileType(fileName, mimeType) {
  const extension = String(fileName || "").split(".").pop()?.toLowerCase();
  const expectedMime = MIME_BY_EXTENSION[extension];
  if (!expectedMime || !ALLOWED_MIME_TYPES.has(mimeType) || expectedMime !== mimeType) return null;
  return { extension, mimeType: expectedMime };
}

export function validateDocumentUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function displayActivityStatus(activity, now = new Date()) {
  if (
    activity?.due_date
    && !["submitted", "needs_revision", "completed"].includes(activity.status)
    && new Date(activity.due_date).getTime() < now.getTime()
  ) return "overdue";
  return activity?.status || "not_started";
}

export function canAccessActivity({ role, userId, activity, writeAsMentor = false }) {
  if (!activity || !userId) return false;
  if (role === "admin") return true;
  if (writeAsMentor) return role === "mentor" && activity.mentor_id === userId;
  if (role === "student") return activity.student_id === userId;
  if (role === "mentor") return activity.mentor_id === userId;
  return false;
}

function mapSubmission(row, feedback = []) {
  return {
    id: row.id,
    activityId: row.activity_id,
    studentId: row.student_id,
    submissionMethod: row.submission_method,
    documentUrl: row.document_url,
    storagePath: row.storage_path,
    originalFileName: row.original_file_name,
    fileMimeType: row.file_mime_type,
    fileSize: row.file_size,
    isDraft: row.is_draft,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    feedback
  };
}

function mapFeedback(row, profileById) {
  return {
    id: row.id,
    activityId: row.activity_id,
    submissionId: row.submission_id,
    mentorId: row.mentor_id,
    mentorName: profileById[row.mentor_id]?.full_name || "Mentor",
    feedbackText: row.feedback_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapActivity(row, { submissions = [], feedback = [], prompts = [], promptResponses = [], profileById = {} } = {}) {
  return {
    id: row.id,
    mentorId: row.mentor_id,
    studentId: row.student_id,
    mentorName: profileById[row.mentor_id]?.full_name || "Mentor",
    studentName: profileById[row.student_id]?.full_name || "Student",
    title: row.title,
    activityType: row.activity_type,
    collegeName: row.college_name,
    essayPrompt: row.essay_prompt,
    wordLimit: row.word_limit,
    instructions: row.instructions,
    dueDate: row.due_date,
    allowedSubmissionMethod: row.allowed_submission_method,
    status: displayActivityStatus(row),
    storedStatus: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    submissions,
    feedback,
    prompts,
    promptResponses
  };
}

function activitySort(a, b) {
  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

async function getCaller(admin, user) {
  const { data, error } = await admin.from("profiles").select("id, role, full_name, email").eq("id", user.id).maybeSingle();
  throwForQuery(error, "Could not verify your account role.");
  if (!data) throw httpError(403, "Your account is not authorized for activities.", "forbidden");
  return { id: user.id, role: String(data.role || "").toLowerCase(), profile: data };
}

async function getActivityRow(admin, activityId) {
  UUID_SCHEMA.parse(activityId);
  const { data, error } = await admin.from("mentor_assigned_activities").select("*").eq("id", activityId).maybeSingle();
  throwForQuery(error, "Could not load this activity.");
  if (!data) throw httpError(404, "Activity not found.", "not_found");
  return data;
}

async function assertAssignedStudent(admin, caller, studentId) {
  if (caller.role === "admin") {
    const { data, error } = await admin.from("profiles").select("id, role").eq("id", studentId).maybeSingle();
    throwForQuery(error, "Could not verify the student.");
    if (!data || data.role !== "student") throw httpError(404, "Student not found.", "not_found");
    return;
  }
  if (caller.role !== "mentor") throw httpError(403, "Only mentors can assign activities.", "forbidden");
  const { data, error } = await admin
    .from("mentor_matches")
    .select("id")
    .eq("mentor_id", caller.id)
    .eq("student_id", studentId)
    .in("status", ACTIVE_MENTOR_MATCH_STATUSES)
    .limit(1);
  throwForQuery(error, "Could not verify the mentor assignment.");
  if (!data?.length) throw httpError(403, "You are not assigned to this student.", "forbidden");
}

async function hydrateActivities(admin, rows) {
  if (!rows.length) return [];
  const activityIds = rows.map((row) => row.id);
  const userIds = [...new Set(rows.flatMap((row) => [row.mentor_id, row.student_id]).filter(Boolean))];
  const [submissionResult, feedbackResult, profileResult, promptResult, promptResponseResult] = await Promise.all([
    admin.from("activity_submissions").select("*").in("activity_id", activityIds).order("created_at", { ascending: false }),
    admin.from("activity_feedback").select("*").in("activity_id", activityIds).order("created_at", { ascending: false }),
    admin.from("profiles").select("id, full_name, role").in("id", userIds),
    admin.from("activity_essay_prompts").select("*").in("activity_id", activityIds).order("display_order", { ascending: true }),
    admin.from("activity_prompt_responses").select("*").in("activity_id", activityIds).order("created_at", { ascending: true })
  ]);
  throwForQuery(submissionResult.error, "Could not load activity submissions.");
  throwForQuery(feedbackResult.error, "Could not load activity feedback.");
  throwForQuery(profileResult.error, "Could not load activity participants.");
  const missingOptionalTable = (error) => ["42P01", "PGRST205"].includes(error?.code);
  if (promptResult.error && !missingOptionalTable(promptResult.error)) throwForQuery(promptResult.error, "Could not load essay prompts.");
  if (promptResponseResult.error && !missingOptionalTable(promptResponseResult.error)) {
    throwForQuery(promptResponseResult.error, "Could not load prompt responses.");
  }
  const profileById = Object.fromEntries((profileResult.data || []).map((profile) => [profile.id, profile]));
  const feedbackByActivity = {};
  const feedbackBySubmission = {};
  for (const row of feedbackResult.data || []) {
    const item = mapFeedback(row, profileById);
    (feedbackByActivity[row.activity_id] ||= []).push(item);
    if (row.submission_id) (feedbackBySubmission[row.submission_id] ||= []).push(item);
  }
  const submissionsByActivity = {};
  for (const row of submissionResult.data || []) {
    (submissionsByActivity[row.activity_id] ||= []).push(mapSubmission(row, feedbackBySubmission[row.id] || []));
  }
  const promptsByActivity = {};
  for (const row of promptResult.data || []) {
    (promptsByActivity[row.activity_id] ||= []).push({
      id: row.id,
      activityId: row.activity_id,
      promptText: row.prompt_text,
      optionalWordLimit: row.optional_word_limit,
      displayOrder: row.display_order
    });
  }
  const responsesByActivity = {};
  for (const row of promptResponseResult.data || []) {
    (responsesByActivity[row.activity_id] ||= []).push({
      id: row.id,
      promptId: row.prompt_id,
      activityId: row.activity_id,
      studentUserId: row.student_user_id,
      responseText: row.response_text,
      submissionStatus: row.submission_status,
      savedAt: row.saved_at,
      submittedAt: row.submitted_at
    });
  }
  return rows.map((row) => mapActivity(row, {
    submissions: submissionsByActivity[row.id] || [],
    feedback: feedbackByActivity[row.id] || [],
    prompts: promptsByActivity[row.id] || [],
    promptResponses: responsesByActivity[row.id] || [],
    profileById
  })).sort(activitySort);
}

async function listAssignedStudents(admin, caller) {
  if (!['mentor', 'admin'].includes(caller.role)) return [];
  let matchesQuery = admin.from("mentor_matches").select("student_id, mentor_id, status, created_at").in("status", ACTIVE_MENTOR_MATCH_STATUSES);
  if (caller.role === "mentor") matchesQuery = matchesQuery.eq("mentor_id", caller.id);
  const { data: matches, error } = await matchesQuery.order("created_at", { ascending: false });
  throwForQuery(error, "Could not load assigned students.");
  const studentIds = [...new Set((matches || []).map((row) => row.student_id).filter(Boolean))];
  if (!studentIds.length) return [];
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name, preferred_name, grade_level, college_interests, plan_id, subscription_status, subscription_cancel_at_period_end, subscription_current_period_start, subscription_current_period_end, entitlement_ends_at, stripe_subscription_id")
    .in("id", studentIds);
  throwForQuery(profilesError, "Could not load assigned student profiles.");
  const students = await Promise.all((profiles || []).map(async (profile) => {
    try {
      const { ensureSessionPeriodForActiveSubscription } = await import("./lib/sessionCredits.js");
      await ensureSessionPeriodForActiveSubscription({
        studentUserId: profile.id,
        planId: profile.plan_id,
        periodStart: profile.subscription_current_period_start || null,
        periodEnd: profile.entitlement_ends_at || profile.subscription_current_period_end || null,
        stripeSubscriptionId: profile.stripe_subscription_id || null
      });
    } catch {
      /* heal best-effort */
    }
    const [reviewBalance, sessionCredits] = await Promise.all([
      getReviewCreditBalance(profile.id),
      getSessionCreditSummary(profile.id).catch(() => ({ active: false, remaining: 0, allowance: 0 }))
    ]);
    const planCredits = buildMentorStudentPlanCredits({
      planId: profile.plan_id,
      subscriptionStatus: profile.subscription_status,
      subscriptionCancelAtPeriodEnd: profile.subscription_cancel_at_period_end,
      subscriptionCurrentPeriodEnd: profile.subscription_current_period_end,
      reviewCredits: reviewBalance,
      sessionCredits
    });
    return {
      id: profile.id,
      name: profile.preferred_name || profile.full_name || "Student",
      grade: profile.grade_level || "",
      colleges: Array.isArray(profile.college_interests) ? profile.college_interests : [],
      plan: planCredits.plan,
      planLabel: planCredits.planLabel,
      paymentType: planCredits.paymentType,
      creditType: planCredits.creditType,
      usageSummary: planCredits.usageSummary,
      essaySupportOnly: planCredits.essaySupportOnly,
      reviewCredits: planCredits.reviewCredits,
      sessionAllowance: planCredits.sessionAllowance,
      subscriptionStatus: planCredits.subscriptionStatus,
      cancelAtPeriodEnd: planCredits.cancelAtPeriodEnd
    };
  }));
  return students.sort((a, b) => a.name.localeCompare(b.name));
}

async function notify(admin, userId, title, body, link) {
  const { error } = await admin.from("notifications").insert({ user_id: userId, title, body, unread: true, link });
  if (error) console.error("[mentor-activities-notification]", { userId, title, error: error.message });
}

function assertActivityAccess(caller, activity, options = {}) {
  if (!canAccessActivity({ role: caller.role, userId: caller.id, activity, writeAsMentor: options.writeAsMentor })) {
    throw httpError(403, "You do not have access to this activity.", "forbidden");
  }
}

async function listActivities(admin, caller, statusFilter) {
  let query = admin.from("mentor_assigned_activities").select("*");
  if (caller.role === "student") query = query.eq("student_id", caller.id);
  else if (caller.role === "mentor") query = query.eq("mentor_id", caller.id);
  else if (caller.role !== "admin") throw httpError(403, "Activities are not available for this account.", "forbidden");
  if (statusFilter && ACTIVITY_STATUSES.includes(statusFilter)) query = query.eq("status", statusFilter);
  const { data, error } = await query.order("created_at", { ascending: false });
  throwForQuery(error, "Could not load activities.");
  return hydrateActivities(admin, data || []);
}

async function createActivity(admin, caller, body) {
  if (!['mentor', 'admin'].includes(caller.role)) throw httpError(403, "Only mentors can assign activities.", "forbidden");
  const input = activityCreateSchema.parse(body);
  await assertAssignedStudent(admin, caller, input.studentId);

  const { data: student, error: studentError } = await admin
    .from("profiles")
    .select("id, plan_id, subscription_status")
    .eq("id", input.studentId)
    .maybeSingle();
  throwForQuery(studentError, "Could not load the student's plan.");
  if (!student) throw httpError(404, "Student not found.", "not_found");

  const balance = await getReviewCreditBalance(input.studentId);
  const essaySupportOnly = isEssaySupportOnlyStudent({
    plan: student.plan_id,
    subscriptionStatus: student.subscription_status
  });
  if (essaySupportOnly && !ESSAY_SUPPORT_ACTIVITY_TYPES.includes(input.activityType)) {
    throw httpError(403, "This activity type is not available for this student’s plan.", "activity_type_not_available");
  }

  const isEssayReview = ESSAY_SUPPORT_ACTIVITY_TYPES.includes(input.activityType);
  const hasPurchasedEssayCredits = Number(balance.purchased || 0) > 0 || Number(balance.remaining || 0) > 0;
  if ((essaySupportOnly || hasPurchasedEssayCredits) && isEssayReview && balance.remaining < 1) {
    throw httpError(409, "This student has no Essay Support review credits remaining.", "no_review_credits");
  }
  // Consume a package credit when inventory remains. Essay Support-only students
  // cannot assign reviews without credits; Plus/Pro may still assign without packages
  // when they have never purchased Essay Support.
  const usesEssayCredits = isEssayReview && balance.remaining > 0;

  const prompts = input.activityType === "supplemental_essay"
    ? (input.prompts?.length
        ? input.prompts
        : (input.essayPrompt ? [{ promptText: input.essayPrompt, optionalWordLimit: input.wordLimit }] : []))
    : [];
  if (input.activityType === "supplemental_essay") {
    if (!input.collegeName) throw httpError(400, "College is required for supplemental essay reviews.", "college_required");
    if (!prompts.length) throw httpError(400, "Add at least one supplemental essay prompt.", "prompt_required");
  }

  const { data, error } = await admin.from("mentor_assigned_activities").insert({
    mentor_id: caller.id,
    student_id: input.studentId,
    title: input.title,
    activity_type: input.activityType,
    college_name: input.collegeName,
    essay_prompt: prompts[0]?.promptText || input.essayPrompt,
    word_limit: prompts[0]?.optionalWordLimit || input.wordLimit,
    instructions: input.instructions,
    due_date: input.dueDate,
    allowed_submission_method: input.allowedSubmissionMethod,
    status: "not_started"
  }).select("*").single();
  throwForQuery(error, "Could not assign this activity.");

  try {
    if (prompts.length) {
      const { error: promptError } = await admin.from("activity_essay_prompts").insert(
        prompts.map((prompt, displayOrder) => ({
          activity_id: data.id,
          prompt_text: prompt.promptText,
          optional_word_limit: prompt.optionalWordLimit || null,
          display_order: displayOrder
        }))
      );
      throwForQuery(promptError, "Could not save the supplemental essay prompts.");
    }
    if (usesEssayCredits) {
      await reserveEssayReviewCredit({
        studentUserId: input.studentId,
        activityId: data.id,
        createdByUserId: caller.id
      });
    }
  } catch (createError) {
    await admin.from("activity_essay_prompts").delete().eq("activity_id", data.id);
    await admin.from("mentor_assigned_activities").delete().eq("id", data.id);
    throw createError;
  }

  await notify(
    admin,
    input.studentId,
    "New mentor activity",
    `Your mentor assigned you a new activity: ${input.title}.`,
    "/dashboard/student/overview"
  );
  return (await hydrateActivities(admin, [data]))[0];
}

async function updateActivity(admin, caller, activityId, body) {
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity, { writeAsMentor: true });
  if (activity.status === "completed") throw httpError(409, "Completed activities cannot be edited.", "activity_completed");
  const input = activityUpdateSchema.parse(body);
  if (!Object.keys(input).length) throw httpError(400, "No activity changes were provided.", "validation_error");
  const payload = {};
  const fields = {
    activityType: "activity_type", title: "title", collegeName: "college_name", essayPrompt: "essay_prompt",
    wordLimit: "word_limit", instructions: "instructions", dueDate: "due_date",
    allowedSubmissionMethod: "allowed_submission_method"
  };
  for (const [inputKey, dbKey] of Object.entries(fields)) {
    if (input[inputKey] !== undefined) payload[dbKey] = input[inputKey];
  }
  const { data, error } = await admin.from("mentor_assigned_activities").update(payload).eq("id", activity.id).select("*").single();
  throwForQuery(error, "Could not update this activity.");
  return (await hydrateActivities(admin, [data]))[0];
}

function assertSubmissionPayload(activity, input) {
  if (activity.status === "completed") throw httpError(409, "This activity is already completed.", "activity_completed");
  if (activity.allowed_submission_method !== "either" && activity.allowed_submission_method !== input.submissionMethod) {
    throw httpError(400, "This submission method is not allowed for the activity.", "submission_method_not_allowed");
  }
  if (input.submissionMethod === "document_link") {
    if (!validateDocumentUrl(input.documentUrl)) throw httpError(400, "Enter a valid http:// or https:// document link.", "invalid_document_url");
    if (input.storagePath) throw httpError(400, "Choose only one submission method.", "validation_error");
  } else {
    if (!input.storagePath || !input.originalFileName || !input.fileMimeType || !input.fileSize) {
      throw httpError(400, "Upload a PDF, DOC, or DOCX file before saving.", "file_required");
    }
    if (input.documentUrl) throw httpError(400, "Choose only one submission method.", "validation_error");
  }
}

function assertStoragePath(activity, storagePath) {
  const expectedPrefix = `${activity.student_id}/${activity.id}/`;
  if (!storagePath?.startsWith(expectedPrefix) || storagePath.includes("..")) {
    throw httpError(403, "The uploaded file does not belong to this activity.", "forbidden");
  }
}

async function verifyStoredFile(admin, bucket, activity, input, maxBytes) {
  assertStoragePath(activity, input.storagePath);
  const parts = input.storagePath.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");
  const { data, error } = await admin.storage.from(bucket).list(folder, { search: fileName, limit: 10 });
  if (error) throw httpError(500, "Could not verify the uploaded file.", "storage_error");
  const object = (data || []).find((item) => item.name === fileName);
  if (!object) throw httpError(400, "The uploaded file could not be found. Upload it again.", "file_not_found");
  const size = Number(object.metadata?.size || input.fileSize);
  const mime = object.metadata?.mimetype || input.fileMimeType;
  const resolved = resolveActivityFileType(input.originalFileName, mime);
  if (!resolved) throw httpError(400, "Only PDF, DOC, and DOCX files are supported.", "unsupported_file_type");
  if (size > maxBytes) throw httpError(413, `Files must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`, "file_too_large");
  return { size, mime };
}

async function saveSubmission(admin, caller, activityId, body, idempotencyKey, config) {
  if (caller.role !== "student") throw httpError(403, "Only students can submit activity work.", "forbidden");
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity);
  const input = submissionSchema.parse(body);
  assertSubmissionPayload(activity, input);
  let verifiedFile = null;
  if (input.submissionMethod === "file_upload") {
    verifiedFile = await verifyStoredFile(admin, config.bucket, activity, input, config.maxBytes);
  }

  const safeIdempotencyKey = String(idempotencyKey || "").trim().slice(0, 120) || null;
  if (!input.isDraft && !safeIdempotencyKey) {
    throw httpError(400, "A submission idempotency key is required.", "idempotency_key_required");
  }
  if (!input.isDraft && safeIdempotencyKey) {
    const { data: prior, error } = await admin
      .from("activity_submissions")
      .select("*")
      .eq("idempotency_key", safeIdempotencyKey)
      .eq("activity_id", activity.id)
      .eq("student_id", caller.id)
      .maybeSingle();
    throwForQuery(error, "Could not verify this submission.");
    if (prior) return { submission: mapSubmission(prior), activity: (await hydrateActivities(admin, [activity]))[0], duplicate: true };
  }

  const { data: draft, error: draftError } = await admin
    .from("activity_submissions")
    .select("*")
    .eq("activity_id", activity.id)
    .eq("student_id", caller.id)
    .eq("is_draft", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwForQuery(draftError, "Could not load the current draft.");
  const now = new Date().toISOString();
  const payload = {
    activity_id: activity.id,
    student_id: caller.id,
    submission_method: input.submissionMethod,
    document_url: input.submissionMethod === "document_link" ? input.documentUrl : null,
    storage_path: input.submissionMethod === "file_upload" ? input.storagePath : null,
    original_file_name: input.submissionMethod === "file_upload" ? sanitizeActivityFileName(input.originalFileName) : null,
    file_mime_type: input.submissionMethod === "file_upload" ? verifiedFile.mime : null,
    file_size: input.submissionMethod === "file_upload" ? verifiedFile.size : null,
    is_draft: input.isDraft,
    idempotency_key: input.isDraft ? null : safeIdempotencyKey,
    submitted_at: input.isDraft ? null : now,
    updated_at: now
  };
  let result;
  if (draft) {
    result = await admin.from("activity_submissions").update(payload).eq("id", draft.id).eq("is_draft", true).select("*").single();
  } else {
    result = await admin.from("activity_submissions").insert(payload).select("*").single();
  }
  if (result.error?.code === "23505" && safeIdempotencyKey) {
    const { data: duplicate } = await admin
      .from("activity_submissions")
      .select("*")
      .eq("idempotency_key", safeIdempotencyKey)
      .eq("activity_id", activity.id)
      .eq("student_id", caller.id)
      .maybeSingle();
    if (duplicate) return { submission: mapSubmission(duplicate), activity: (await hydrateActivities(admin, [activity]))[0], duplicate: true };
  }
  throwForQuery(result.error, "Could not save this submission.");

  const nextStatus = input.isDraft
    ? (activity.status === "needs_revision" ? "needs_revision" : "in_progress")
    : "submitted";
  const { data: updatedActivity, error: activityError } = await admin
    .from("mentor_assigned_activities")
    .update({ status: nextStatus, updated_at: now })
    .eq("id", activity.id)
    .neq("status", "completed")
    .select("*")
    .single();
  throwForQuery(activityError, "The submission was saved, but the activity status could not be updated.");
  if (!input.isDraft) {
    await notify(
      admin,
      activity.mentor_id,
      "Activity submitted",
      `${caller.profile.full_name || "A student"} submitted ${activity.title}.`,
      "/dashboard/mentor/overview"
    );
  }
  return {
    submission: mapSubmission(result.data),
    activity: (await hydrateActivities(admin, [updatedActivity]))[0],
    duplicate: false
  };
}

async function createUploadUrl(admin, caller, activityId, body, config) {
  if (caller.role !== "student") throw httpError(403, "Only students can upload activity files.", "forbidden");
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity);
  if (activity.status === "completed") throw httpError(409, "This activity is already completed.", "activity_completed");
  if (activity.allowed_submission_method === "document_link") throw httpError(400, "File uploads are not allowed for this activity.", "submission_method_not_allowed");
  const input = fileSchema.parse(body);
  if (input.fileSize > config.maxBytes) throw httpError(413, `Files must be ${Math.floor(config.maxBytes / 1024 / 1024)} MB or smaller.`, "file_too_large");
  const resolved = resolveActivityFileType(input.fileName, input.fileMimeType);
  if (!resolved) throw httpError(400, "Only PDF, DOC, and DOCX files are supported.", "unsupported_file_type");
  const safeName = sanitizeActivityFileName(input.fileName);
  const path = `${caller.id}/${activity.id}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await admin.storage.from(config.bucket).createSignedUploadUrl(path, { upsert: false });
  if (error) throw httpError(503, "Secure activity storage is unavailable. Ask an administrator to apply the storage migration.", "storage_unavailable");
  return { path, signedUrl: data.signedUrl, token: data.token, fileName: safeName, maxBytes: config.maxBytes };
}

async function createFileUrl(admin, caller, activityId, body, config) {
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity);
  const input = fileUrlSchema.parse(body);
  const { data: submission, error } = await admin.from("activity_submissions").select("*").eq("id", input.submissionId).eq("activity_id", activity.id).maybeSingle();
  throwForQuery(error, "Could not load this submission file.");
  if (!submission?.storage_path) throw httpError(404, "Submission file not found.", "not_found");
  assertStoragePath(activity, submission.storage_path);
  const { data, error: signedError } = await admin.storage.from(config.bucket).createSignedUrl(submission.storage_path, 300, {
    download: submission.original_file_name || "activity-document"
  });
  if (signedError) throw httpError(503, "Could not open this secure file.", "storage_unavailable");
  return { signedUrl: data.signedUrl, expiresIn: 300 };
}

async function removeDraftFile(admin, caller, activityId, body, config) {
  if (caller.role !== "student") throw httpError(403, "Only students can remove draft files.", "forbidden");
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity);
  const input = filePathSchema.parse(body);
  assertStoragePath(activity, input.storagePath);
  const { data: references, error } = await admin.from("activity_submissions").select("id, is_draft").eq("activity_id", activity.id).eq("storage_path", input.storagePath);
  throwForQuery(error, "Could not verify this draft file.");
  if ((references || []).some((item) => !item.is_draft)) throw httpError(409, "Submitted revision files cannot be removed.", "submitted_file");
  const draftIds = (references || []).map((item) => item.id);
  if (draftIds.length) {
    const { error: deleteDraftError } = await admin.from("activity_submissions").delete().in("id", draftIds).eq("student_id", caller.id);
    throwForQuery(deleteDraftError, "Could not remove the saved draft.");
  }
  const { error: storageError } = await admin.storage.from(config.bucket).remove([input.storagePath]);
  if (storageError) throw httpError(503, "Could not remove the draft file.", "storage_unavailable");
  return { removed: true };
}

async function addFeedback(admin, caller, activityId, body) {
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity, { writeAsMentor: true });
  const input = feedbackSchema.parse(body);
  if (input.submissionId) {
    const { data, error } = await admin.from("activity_submissions").select("id").eq("id", input.submissionId).eq("activity_id", activity.id).maybeSingle();
    throwForQuery(error, "Could not verify the submission.");
    if (!data) throw httpError(404, "Submission not found.", "not_found");
  }
  const { data, error } = await admin.from("activity_feedback").insert({
    activity_id: activity.id,
    submission_id: input.submissionId || null,
    mentor_id: caller.id,
    feedback_text: input.feedbackText
  }).select("*").single();
  throwForQuery(error, "Could not save feedback.");
  await notify(admin, activity.student_id, "New mentor feedback", `Your mentor left feedback on ${activity.title}.`, "/dashboard/student/overview");
  return mapFeedback(data, { [caller.id]: caller.profile });
}

async function reviewActivity(admin, caller, activityId, body) {
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity, { writeAsMentor: true });
  if (activity.status === "completed") throw httpError(409, "This activity is already completed.", "activity_completed");
  const input = reviewSchema.parse(body);
  if (!input.submissionId) throw httpError(400, "Choose a submitted revision to review.", "submission_required");
  const { data: reviewedSubmission, error: submissionError } = await admin
    .from("activity_submissions")
    .select("id")
    .eq("id", input.submissionId)
    .eq("activity_id", activity.id)
    .eq("is_draft", false)
    .maybeSingle();
  throwForQuery(submissionError, "Could not verify the submission.");
  if (!reviewedSubmission) throw httpError(404, "Submitted revision not found.", "not_found");
  if (input.feedbackText) {
    const { error } = await admin.from("activity_feedback").insert({
      activity_id: activity.id,
      submission_id: input.submissionId || null,
      mentor_id: caller.id,
      feedback_text: input.feedbackText
    });
    throwForQuery(error, "Could not save review feedback.");
  }
  const completedAt = input.status === "completed" ? new Date().toISOString() : null;
  const { data, error } = await admin.from("mentor_assigned_activities").update({
    status: input.status,
    completed_at: completedAt,
    updated_at: new Date().toISOString()
  }).eq("id", activity.id).select("*").single();
  throwForQuery(error, "Could not update this activity review.");
  const bodyText = input.status === "needs_revision"
    ? `Your submission for ${activity.title} is ready for revision.`
    : `Your mentor marked ${activity.title} as completed.`;
  await notify(
    admin,
    activity.student_id,
    input.status === "needs_revision" ? "Revision requested" : "Activity completed",
    bodyText,
    "/dashboard/student/overview"
  );
  return (await hydrateActivities(admin, [data]))[0];
}

async function savePromptResponses(admin, caller, activityId, body) {
  if (caller.role !== "student") throw httpError(403, "Only students can save prompt responses.", "forbidden");
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity);
  if (activity.status === "completed") throw httpError(409, "This activity is already completed.", "activity_completed");
  const input = promptResponsesSchema.parse(body);
  const promptIds = input.responses.map((response) => response.promptId);
  if (new Set(promptIds).size !== promptIds.length) {
    throw httpError(400, "Each essay prompt can only have one response.", "duplicate_prompt");
  }
  const { data: prompts, error: promptError } = await admin
    .from("activity_essay_prompts")
    .select("id")
    .eq("activity_id", activity.id);
  throwForQuery(promptError, "Could not verify the essay prompts.");
  const activityPromptIds = new Set((prompts || []).map((prompt) => prompt.id));
  if (promptIds.some((promptId) => !activityPromptIds.has(promptId))) {
    throw httpError(400, "One or more prompt responses do not belong to this activity.", "invalid_prompt");
  }

  const now = new Date().toISOString();
  const rows = input.responses.map((response) => ({
    prompt_id: response.promptId,
    activity_id: activity.id,
    student_user_id: caller.id,
    response_text: response.responseText,
    submission_status: response.submissionStatus,
    saved_at: now,
    submitted_at: response.submissionStatus === "submitted" ? now : null,
    updated_at: now
  }));
  const { error } = await admin
    .from("activity_prompt_responses")
    .upsert(rows, { onConflict: "prompt_id,student_user_id" });
  throwForQuery(error, "Could not save prompt responses.");
  const allSubmitted =
    input.responses.length === activityPromptIds.size &&
    input.responses.every((response) => response.submissionStatus === "submitted");
  const { data: updated, error: updateError } = await admin
    .from("mentor_assigned_activities")
    .update({ status: allSubmitted ? "submitted" : "in_progress", updated_at: now })
    .eq("id", activity.id)
    .select("*")
    .single();
  throwForQuery(updateError, "Prompt responses were saved, but activity status could not be updated.");
  return (await hydrateActivities(admin, [updated]))[0];
}

async function deleteActivity(admin, caller, activityId) {
  const activity = await getActivityRow(admin, activityId);
  assertActivityAccess(caller, activity, { writeAsMentor: true });
  const [submissionResult, feedbackResult] = await Promise.all([
    admin.from("activity_submissions").select("id").eq("activity_id", activity.id).eq("is_draft", false).limit(1),
    admin.from("activity_feedback").select("id").eq("activity_id", activity.id).limit(1)
  ]);
  throwForQuery(submissionResult.error, "Could not verify activity submissions.");
  throwForQuery(feedbackResult.error, "Could not verify activity feedback.");
  const eligibleForRestore =
    ["not_started", "in_progress"].includes(activity.status) &&
    !(submissionResult.data || []).length &&
    !(feedbackResult.data || []).length;

  const { error } = await admin.from("mentor_assigned_activities").delete().eq("id", activity.id);
  throwForQuery(error, "Could not delete this activity.");
  let restored = null;
  if (ESSAY_SUPPORT_ACTIVITY_TYPES.includes(activity.activity_type)) {
    restored = await restoreEssayReviewCreditOnCancel({
      studentUserId: activity.student_id,
      activityId: activity.id,
      createdByUserId: caller.id,
      eligible: eligibleForRestore
    });
  }
  return { deleted: true, creditRestored: Boolean(restored) };
}

function activityConfig(env) {
  const configuredMax = Number(env.MENTOR_ACTIVITY_MAX_FILE_BYTES);
  return {
    bucket: env.MENTOR_ACTIVITY_STORAGE_BUCKET || DEFAULT_ACTIVITY_BUCKET,
    maxBytes: Number.isFinite(configuredMax) && configuredMax > 0 ? Math.min(configuredMax, DEFAULT_MAX_FILE_BYTES) : DEFAULT_MAX_FILE_BYTES
  };
}

export function createMentorActivitiesApiMiddleware({
  requireUser = requireSupabaseUser,
  getAdmin = getSupabaseAdmin,
  env = process.env
} = {}) {
  const config = activityConfig(env);
  return async function mentorActivitiesApi(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/api/activities" && !url.pathname.startsWith("/api/activities/")) return next();
    try {
      const { user } = await requireUser(req);
      const admin = getAdmin();
      if (!admin) throw httpError(503, "Activity storage and data access are not configured.", "service_unavailable");
      const caller = await getCaller(admin, user);
      const parts = url.pathname.split("/").filter(Boolean).slice(2).map(decodeURIComponent);
      const [activityId, action] = parts;

      if (!activityId && req.method === "GET") {
        const activities = await listActivities(admin, caller, url.searchParams.get("status"));
        const students = await listAssignedStudents(admin, caller);
        return sendJson(res, 200, { activities, students, role: caller.role });
      }
      if (!activityId && req.method === "POST") {
        const activity = await createActivity(admin, caller, await readJsonBody(req));
        return sendJson(res, 201, { activity });
      }
      if (activityId === "students" && req.method === "GET") {
        return sendJson(res, 200, { students: await listAssignedStudents(admin, caller) });
      }
      if (activityId && !action && req.method === "GET") {
        const activity = await getActivityRow(admin, activityId);
        assertActivityAccess(caller, activity);
        return sendJson(res, 200, { activity: (await hydrateActivities(admin, [activity]))[0] });
      }
      if (activityId && !action && req.method === "PATCH") {
        return sendJson(res, 200, { activity: await updateActivity(admin, caller, activityId, await readJsonBody(req)) });
      }
      if (activityId && !action && req.method === "DELETE") {
        return sendJson(res, 200, await deleteActivity(admin, caller, activityId));
      }
      if (action === "prompt-responses" && req.method === "POST") {
        return sendJson(res, 200, { activity: await savePromptResponses(admin, caller, activityId, await readJsonBody(req)) });
      }
      if (action === "submissions" && req.method === "POST") {
        const result = await saveSubmission(admin, caller, activityId, await readJsonBody(req), req.headers["idempotency-key"], config);
        return sendJson(res, result.duplicate ? 200 : 201, result);
      }
      if (action === "upload-url" && req.method === "POST") {
        return sendJson(res, 201, await createUploadUrl(admin, caller, activityId, await readJsonBody(req), config));
      }
      if (action === "file-url" && req.method === "POST") {
        return sendJson(res, 200, await createFileUrl(admin, caller, activityId, await readJsonBody(req), config));
      }
      if (action === "file" && req.method === "DELETE") {
        return sendJson(res, 200, await removeDraftFile(admin, caller, activityId, await readJsonBody(req), config));
      }
      if (action === "feedback" && req.method === "POST") {
        return sendJson(res, 201, { feedback: await addFeedback(admin, caller, activityId, await readJsonBody(req)) });
      }
      if (action === "review" && req.method === "PATCH") {
        return sendJson(res, 200, { activity: await reviewActivity(admin, caller, activityId, await readJsonBody(req)) });
      }
      return sendJson(res, 405, { error: "method_not_allowed", message: "Activity route does not support this method." }, { Allow: "GET, POST, PATCH, DELETE" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", message: error.issues[0]?.message || "Invalid activity data.", issues: error.issues });
      }
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { error: "invalid_json", message: "Request body must be valid JSON." });
      }
      const status = Number(error?.statusCode) || 500;
      if (status >= 500) console.error("[mentor-activities-api]", error);
      return sendJson(res, status, {
        error: error?.code || (status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : "activity_request_failed"),
        message: status >= 500 ? (error?.message || "Activity request failed.") : error.message
      });
    }
  };
}

const mentorActivitiesMiddleware = createMentorActivitiesApiMiddleware();

export default withApiRateLimit(function mentorActivitiesHandler(req, res) {
  return mentorActivitiesMiddleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
});
