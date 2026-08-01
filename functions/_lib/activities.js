/**
 * Workers port of server/mentorActivitiesApi.js.
 *
 * All data access goes through the service-role REST client (adminRest) because the
 * mentor_assigned_activities / activity_submissions / activity_feedback tables are locked
 * down to service_role only (see the dashboard production reconciliation migration).
 * Authorization is enforced in application code, mirroring canAccessActivity/assertActivityAccess
 * from the Node implementation, after verifying the caller's bearer token via requireUser.
 *
 * Review-credit bookkeeping (review_credit_ledger, session_package_purchases) is re-implemented
 * here against plain Postgres tables via REST instead of Prisma, since Prisma's engine and the
 * JSON-file ledger fallback used by server/lib/reviewCredits.js are not available in the Workers
 * runtime. Only the consume/restore paths needed by activity assignment + cancellation are ported;
 * granting credits after a Stripe purchase continues to run on the Node server (billing webhook).
 */

import { adminRest, first, httpError, json, readJsonBody, runAuthenticated, runtimeFetch, supabaseConfig } from "./http.js";

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
export const ESSAY_SUPPORT_ACTIVITY_TYPES = Object.freeze(["personal_statement", "supplemental_essay"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

// ---------------------------------------------------------------------------
// Pure helpers (ported verbatim from server/mentorActivitiesApi.js)
// ---------------------------------------------------------------------------

function assertUuid(value, message) {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw httpError(message, 400, "validation_error");
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
    activity?.due_date &&
    !["submitted", "needs_revision", "completed"].includes(activity.status) &&
    new Date(activity.due_date).getTime() < now.getTime()
  ) {
    return "overdue";
  }
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

function assertActivityAccessRow(caller, activity, options = {}) {
  if (!canAccessActivity({ role: caller.role, userId: caller.id, activity, writeAsMentor: options.writeAsMentor })) {
    throw httpError("You do not have access to this activity.", 403, "forbidden");
  }
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

function assertSubmissionPayload(activity, input) {
  if (activity.status === "completed") throw httpError("This activity is already completed.", 409, "activity_completed");
  if (activity.allowed_submission_method !== "either" && activity.allowed_submission_method !== input.submissionMethod) {
    throw httpError("This submission method is not allowed for the activity.", 400, "submission_method_not_allowed");
  }
  if (input.submissionMethod === "document_link") {
    if (!validateDocumentUrl(input.documentUrl)) throw httpError("Enter a valid http:// or https:// document link.", 400, "invalid_document_url");
    if (input.storagePath) throw httpError("Choose only one submission method.", 400, "validation_error");
  } else {
    if (!input.storagePath || !input.originalFileName || !input.fileMimeType || !input.fileSize) {
      throw httpError("Upload a PDF, DOC, or DOCX file before saving.", 400, "file_required");
    }
    if (input.documentUrl) throw httpError("Choose only one submission method.", 400, "validation_error");
  }
}

function assertStoragePath(activity, storagePath) {
  const expectedPrefix = `${activity.student_id}/${activity.id}/`;
  if (!storagePath?.startsWith(expectedPrefix) || storagePath.includes("..")) {
    throw httpError("The uploaded file does not belong to this activity.", 403, "forbidden");
  }
}

/** True when student is not on an active Plus/Pro subscription. */
export function isEssaySupportOnlyStudent(user = {}) {
  const plan = String(user.plan || user.planId || user.subscriptionPlan || "basic").trim().toLowerCase();
  if (plan !== "plus" && plan !== "pro") return true;
  const status = String(user.subscriptionStatus || user.subscription_status || "").trim().toLowerCase();
  return !["", "active", "trialing", "promotional", "checkout_completed"].includes(status);
}

function sumEssayPackageRemaining(packages = []) {
  const now = Date.now();
  return packages.reduce((total, pkg) => {
    if (!pkg) return total;
    if (String(pkg.bundleId || "").trim().toLowerCase() !== "essay_support") return total;
    const status = String(pkg.status || "active").toLowerCase();
    if (status !== "active") return total;
    if (pkg.expiresAt) {
      const expires = new Date(pkg.expiresAt).getTime();
      if (!Number.isNaN(expires) && expires <= now) return total;
    }
    const remaining = Number(pkg.sessionsRemaining);
    if (!Number.isFinite(remaining) || remaining <= 0) return total;
    return total + remaining;
  }, 0);
}

function summarizeReviewCredits(entries = [], packages = []) {
  let purchased = 0;
  let assigned = 0;
  let restored = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    const type = String(entry.transactionType || "");
    if (type === "PURCHASE" || type === "ADMIN_ADJUSTMENT") {
      if (amount > 0) purchased += amount;
    }
    if (type === "ACTIVITY_ASSIGNED" && amount < 0) assigned += Math.abs(amount);
    if (type === "ACTIVITY_CANCELLED" && amount > 0) restored += amount;
    if (type === "REFUND" && amount < 0) purchased = Math.max(0, purchased + amount);
  }
  const remainingFromLedger = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const remainingFromPackages = sumEssayPackageRemaining(packages);
  const remaining = Math.max(0, Math.max(remainingFromLedger, remainingFromPackages));
  return {
    purchased: Math.max(purchased, remaining + assigned - restored),
    assigned: Math.max(0, assigned - restored),
    remaining
  };
}

// ---------------------------------------------------------------------------
// Storage helpers (Supabase Storage REST API, service role only)
// ---------------------------------------------------------------------------

async function storageRequest(context, path, options = {}) {
  const { url, serviceRoleKey } = supabaseConfig(context);
  if (!url || !serviceRoleKey) throw httpError("Secure activity storage is unavailable. Ask an administrator to apply the storage migration.", 503, "storage_unavailable");
  return runtimeFetch(context)(`${url.replace(/\/$/, "")}/storage/v1${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

function encodeStoragePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function listStorageObjects(context, bucket, folder, options = {}) {
  const response = await storageRequest(context, `/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    body: JSON.stringify({
      prefix: folder || "",
      limit: options.limit || 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
      ...(options.search ? { search: options.search } : {})
    })
  });
  if (!response.ok) throw httpError("Could not verify the uploaded file.", 500, "storage_error");
  const body = await response.json().catch(() => null);
  return Array.isArray(body) ? body : [];
}

async function createSignedUploadUrl(context, bucket, path) {
  const response = await storageRequest(context, `/object/upload/sign/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`, {
    method: "POST",
    body: JSON.stringify({})
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.url) throw httpError("Secure activity storage is unavailable. Ask an administrator to apply the storage migration.", 503, "storage_unavailable");
  const { url: baseUrl } = supabaseConfig(context);
  const absolute = new URL(`${baseUrl.replace(/\/$/, "")}/storage/v1${body.url}`);
  const token = absolute.searchParams.get("token");
  if (!token) throw httpError("Secure activity storage is unavailable.", 503, "storage_unavailable");
  return { signedUrl: absolute.toString(), token };
}

async function createSignedDownloadUrl(context, bucket, path, expiresIn, downloadName) {
  const response = await storageRequest(context, `/object/sign/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.signedURL) throw httpError("Could not open this secure file.", 503, "storage_unavailable");
  const { url: baseUrl } = supabaseConfig(context);
  const downloadParam = downloadName ? `&download=${encodeURIComponent(downloadName)}` : "";
  return `${baseUrl.replace(/\/$/, "")}/storage/v1${body.signedURL}${downloadParam}`;
}

async function removeStorageObjects(context, bucket, paths) {
  const response = await storageRequest(context, `/object/remove/${encodeURIComponent(bucket)}`, {
    method: "POST",
    body: JSON.stringify({ prefixes: paths })
  });
  if (!response.ok) throw httpError("Could not remove the draft file.", 503, "storage_unavailable");
}

// ---------------------------------------------------------------------------
// Review credit ledger (REST port of server/lib/reviewCredits.js + mentorAccess.js)
// ---------------------------------------------------------------------------

function rowToLedgerEntry(row) {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    amount: Number(row.amount) || 0,
    transactionType: row.transaction_type,
    packageKey: row.package_key,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    activityId: row.activity_id,
    packagePurchaseId: row.package_purchase_id,
    idempotencyKey: row.idempotency_key,
    reason: row.reason,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  };
}

function rowToPackageRecord(row) {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    mentorUserId: row.mentor_user_id ?? null,
    bundleId: row.bundle_id || "flexible_sessions",
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    sessionsPurchased: Number(row.sessions_purchased) || 0,
    sessionsRemaining: Number(row.sessions_remaining) || 0,
    status: row.status || "active",
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

async function listReviewCreditLedger(context, studentUserId) {
  if (!studentUserId) return [];
  const rows = await adminRest(context, `review_credit_ledger?select=*&student_user_id=eq.${encodeURIComponent(studentUserId)}&order=created_at.asc`);
  return (rows || []).map(rowToLedgerEntry);
}

async function listEssayPackagesForStudent(context, studentUserId) {
  if (!studentUserId) return [];
  const rows = await adminRest(
    context,
    `session_package_purchases?select=*&student_user_id=eq.${encodeURIComponent(studentUserId)}&bundle_id=eq.essay_support&order=created_at.asc`
  );
  return (rows || []).map(rowToPackageRecord);
}

async function getReviewCreditBalance(context, studentUserId) {
  const [entries, packages] = await Promise.all([
    listReviewCreditLedger(context, studentUserId),
    listEssayPackagesForStudent(context, studentUserId)
  ]);
  return { ...summarizeReviewCredits(entries, packages), packages, ledger: entries };
}

async function findLedgerByIdempotencyKey(context, key) {
  if (!key) return null;
  const rows = await adminRest(context, `review_credit_ledger?select=*&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`);
  const row = first(rows);
  return row ? rowToLedgerEntry(row) : null;
}

async function appendLedgerEntry(context, entry) {
  const existing = await findLedgerByIdempotencyKey(context, entry.idempotencyKey);
  if (existing) return { ...existing, duplicate: true };
  const insert = {
    student_user_id: entry.studentUserId,
    amount: Number(entry.amount),
    transaction_type: entry.transactionType,
    package_key: entry.packageKey || null,
    stripe_checkout_session_id: entry.stripeCheckoutSessionId || null,
    stripe_payment_intent_id: entry.stripePaymentIntentId || null,
    activity_id: entry.activityId || null,
    package_purchase_id: entry.packagePurchaseId || null,
    idempotency_key: entry.idempotencyKey,
    reason: entry.reason || null,
    created_by_user_id: entry.createdByUserId || null
  };
  try {
    const rows = await adminRest(context, "review_credit_ledger", { method: "POST", body: JSON.stringify(insert) });
    return { ...rowToLedgerEntry(first(rows)), duplicate: false };
  } catch (error) {
    if (error?.status === 409) {
      const duplicate = await findLedgerByIdempotencyKey(context, entry.idempotencyKey);
      if (duplicate) return { ...duplicate, duplicate: true };
    }
    throw error;
  }
}

/** Optimistic-concurrency decrement: only succeeds if the package is still active with the observed balance. */
async function consumeEssayPackageCredit(context, studentUserId) {
  const candidates = await adminRest(
    context,
    `session_package_purchases?select=*&student_user_id=eq.${encodeURIComponent(studentUserId)}&bundle_id=eq.essay_support&status=eq.active&sessions_remaining=gt.0&order=created_at.asc`
  );
  for (const candidate of candidates || []) {
    const remaining = Number(candidate.sessions_remaining) || 0;
    const nextRemaining = remaining - 1;
    const rows = await adminRest(
      context,
      `session_package_purchases?id=eq.${encodeURIComponent(candidate.id)}&status=eq.active&sessions_remaining=eq.${remaining}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sessions_remaining: nextRemaining,
          status: nextRemaining <= 0 ? "depleted" : "active",
          updated_at: new Date().toISOString()
        })
      }
    );
    if (first(rows)) return candidate.id;
  }
  return null;
}

async function releasePackageSession(context, packageId) {
  if (!packageId) return false;
  const rows = await adminRest(context, `session_package_purchases?select=*&id=eq.${encodeURIComponent(packageId)}&limit=1`);
  const pkg = first(rows);
  if (!pkg) return false;
  const updated = await adminRest(context, `session_package_purchases?id=eq.${encodeURIComponent(packageId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      sessions_remaining: (Number(pkg.sessions_remaining) || 0) + 1,
      status: "active",
      updated_at: new Date().toISOString()
    })
  });
  return Boolean(first(updated));
}

async function reserveEssayReviewCredit(context, { studentUserId, activityId, createdByUserId = null, reason = "Mentor assigned essay review" }) {
  const priorEntries = await listReviewCreditLedger(context, studentUserId);
  const priorAssignment = priorEntries.find((entry) => entry.activityId === activityId && entry.transactionType === "ACTIVITY_ASSIGNED");
  if (priorAssignment) return { reserved: true, packageId: priorAssignment.packagePurchaseId || null, duplicate: true };

  const balance = await getReviewCreditBalance(context, studentUserId);
  if (balance.remaining <= 0) throw httpError("This student has no Essay Support review credits remaining.", 409, "no_review_credits");

  const packageId = await consumeEssayPackageCredit(context, studentUserId);
  if (!packageId) throw httpError("This student has no Essay Support review credits remaining.", 409, "no_review_credits");

  try {
    const ledgerEntry = await appendLedgerEntry(context, {
      studentUserId,
      amount: -1,
      transactionType: "ACTIVITY_ASSIGNED",
      activityId,
      packagePurchaseId: packageId,
      createdByUserId,
      reason,
      idempotencyKey: `activity-assigned:${activityId}`
    });
    if (ledgerEntry.duplicate) {
      await releasePackageSession(context, packageId);
      return { reserved: true, packageId: ledgerEntry.packagePurchaseId || null, duplicate: true };
    }
  } catch (error) {
    await releasePackageSession(context, packageId);
    throw error;
  }
  return { reserved: true, packageId };
}

async function restoreEssayReviewCreditOnCancel(context, { studentUserId, activityId, createdByUserId = null, eligible = true }) {
  if (!eligible || !studentUserId || !activityId) return null;
  const entries = await listReviewCreditLedger(context, studentUserId);
  const assigned = entries.find((entry) => entry.activityId === activityId && entry.transactionType === "ACTIVITY_ASSIGNED");
  const alreadyRestored = entries.some((entry) => entry.activityId === activityId && entry.transactionType === "ACTIVITY_CANCELLED");
  if (alreadyRestored || !assigned) return null;
  const cancellation = await appendLedgerEntry(context, {
    studentUserId,
    amount: 1,
    transactionType: "ACTIVITY_CANCELLED",
    activityId,
    createdByUserId,
    reason: "Activity cancelled before review started",
    idempotencyKey: `activity-cancelled:${activityId}`
  });
  if (!cancellation.duplicate && assigned.packagePurchaseId) {
    await releasePackageSession(context, assigned.packagePurchaseId);
  }
  return cancellation;
}

// ---------------------------------------------------------------------------
// Input validation (manual port of the zod schemas in mentorActivitiesApi.js)
// ---------------------------------------------------------------------------

function optionalTextOrNull(value, max) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw httpError("Text exceeds the allowed length.", 400, "validation_error");
  return text;
}

function parsePositiveInt(value, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > max) throw httpError("Invalid number provided.", 400, "validation_error");
  return n;
}

function parseEssayPrompt(raw) {
  if (!raw || typeof raw !== "object") throw httpError("Invalid essay prompt.", 400, "validation_error");
  const promptText = String(raw.promptText || "").trim();
  if (!promptText || promptText.length > 20000) throw httpError("Essay prompt text is required.", 400, "validation_error");
  const optionalWordLimit = raw.optionalWordLimit === undefined || raw.optionalWordLimit === null
    ? null
    : parsePositiveInt(raw.optionalWordLimit, 100000);
  return { promptText, optionalWordLimit };
}

function parseActivityCreate(body) {
  const b = body || {};
  assertUuid(b.studentId, "A valid student is required.");
  if (!ACTIVITY_TYPES.includes(b.activityType)) throw httpError("Invalid activity type.", 400, "validation_error");
  const title = String(b.title || "").trim();
  if (!title || title.length > 180) throw httpError("Activity title is required.", 400, "validation_error");
  if (Array.isArray(b.prompts) && b.prompts.length > 50) throw httpError("Too many essay prompts.", 400, "validation_error");
  const dueDate = (() => {
    if (b.dueDate === undefined || b.dueDate === null) return null;
    if (Number.isNaN(new Date(b.dueDate).getTime())) throw httpError("Invalid due date.", 400, "validation_error");
    return b.dueDate;
  })();
  const allowedSubmissionMethod = b.allowedSubmissionMethod || "either";
  if (!ALLOWED_SUBMISSION_METHODS.includes(allowedSubmissionMethod)) throw httpError("Invalid submission method.", 400, "validation_error");
  return {
    studentId: b.studentId,
    activityType: b.activityType,
    title,
    collegeName: optionalTextOrNull(b.collegeName, 180),
    essayPrompt: optionalTextOrNull(b.essayPrompt, 20000),
    prompts: Array.isArray(b.prompts) ? b.prompts.map(parseEssayPrompt) : undefined,
    wordLimit: b.wordLimit === undefined || b.wordLimit === null ? null : parsePositiveInt(b.wordLimit, 100000),
    instructions: optionalTextOrNull(b.instructions, 20000),
    dueDate,
    allowedSubmissionMethod
  };
}

function parseActivityUpdate(body) {
  const b = body || {};
  const out = {};
  if (b.activityType !== undefined) {
    if (!ACTIVITY_TYPES.includes(b.activityType)) throw httpError("Invalid activity type.", 400, "validation_error");
    out.activityType = b.activityType;
  }
  if (b.title !== undefined) {
    const title = String(b.title || "").trim();
    if (!title || title.length > 180) throw httpError("Activity title is invalid.", 400, "validation_error");
    out.title = title;
  }
  if (b.collegeName !== undefined) out.collegeName = optionalTextOrNull(b.collegeName, 180);
  if (b.essayPrompt !== undefined) out.essayPrompt = optionalTextOrNull(b.essayPrompt, 20000);
  if (b.wordLimit !== undefined) out.wordLimit = b.wordLimit === null ? null : parsePositiveInt(b.wordLimit, 100000);
  if (b.instructions !== undefined) out.instructions = optionalTextOrNull(b.instructions, 20000);
  if (b.dueDate !== undefined) {
    if (b.dueDate === null) out.dueDate = null;
    else {
      if (Number.isNaN(new Date(b.dueDate).getTime())) throw httpError("Invalid due date.", 400, "validation_error");
      out.dueDate = b.dueDate;
    }
  }
  if (b.allowedSubmissionMethod !== undefined) {
    if (!ALLOWED_SUBMISSION_METHODS.includes(b.allowedSubmissionMethod)) throw httpError("Invalid submission method.", 400, "validation_error");
    out.allowedSubmissionMethod = b.allowedSubmissionMethod;
  }
  return out;
}

function parseSubmission(body) {
  const b = body || {};
  if (!SUBMISSION_METHODS.includes(b.submissionMethod)) throw httpError("Invalid submission method.", 400, "validation_error");
  return {
    submissionMethod: b.submissionMethod,
    documentUrl: optionalTextOrNull(b.documentUrl, 2048),
    storagePath: optionalTextOrNull(b.storagePath, 1024),
    originalFileName: optionalTextOrNull(b.originalFileName, 255),
    fileMimeType: optionalTextOrNull(b.fileMimeType, 120),
    fileSize: b.fileSize === undefined || b.fileSize === null ? null : parsePositiveInt(b.fileSize, DEFAULT_MAX_FILE_BYTES),
    isDraft: b.isDraft === undefined ? true : Boolean(b.isDraft)
  };
}

function parseFeedback(body) {
  const b = body || {};
  const feedbackText = String(b.feedbackText || "").trim();
  if (!feedbackText || feedbackText.length > 10000) throw httpError("Feedback text is required.", 400, "validation_error");
  let submissionId = null;
  if (b.submissionId !== undefined && b.submissionId !== null) {
    assertUuid(b.submissionId, "Invalid submission id.");
    submissionId = b.submissionId;
  }
  return { feedbackText, submissionId };
}

function parseReview(body) {
  const b = body || {};
  if (!["needs_revision", "completed"].includes(b.status)) throw httpError("Invalid review status.", 400, "validation_error");
  let feedbackText = null;
  if (b.feedbackText !== undefined && b.feedbackText !== null) {
    feedbackText = String(b.feedbackText).trim();
    if (feedbackText.length > 10000) throw httpError("Feedback is too long.", 400, "validation_error");
    if (!feedbackText) feedbackText = null;
  }
  if (b.status === "needs_revision" && !feedbackText) {
    throw httpError("Feedback is required when requesting a revision.", 400, "validation_error");
  }
  let submissionId = null;
  if (b.submissionId !== undefined && b.submissionId !== null) {
    assertUuid(b.submissionId, "Invalid submission id.");
    submissionId = b.submissionId;
  }
  return { status: b.status, feedbackText, submissionId };
}

function parseFileSchema(body) {
  const b = body || {};
  const fileName = String(b.fileName || "").trim();
  if (!fileName || fileName.length > 255) throw httpError("A file name is required.", 400, "validation_error");
  const fileMimeType = String(b.fileMimeType || "").trim();
  if (!fileMimeType || fileMimeType.length > 120) throw httpError("A file type is required.", 400, "validation_error");
  const fileSize = parsePositiveInt(b.fileSize, Number.MAX_SAFE_INTEGER);
  return { fileName, fileMimeType, fileSize };
}

function parseFilePath(body) {
  const storagePath = String(body?.storagePath || "").trim();
  if (!storagePath || storagePath.length > 1024) throw httpError("A storage path is required.", 400, "validation_error");
  return { storagePath };
}

function parseFileUrl(body) {
  assertUuid(body?.submissionId, "A valid submission is required.");
  return { submissionId: body.submissionId };
}

function parsePromptResponses(body) {
  const responses = Array.isArray(body?.responses) ? body.responses : null;
  if (!responses || !responses.length || responses.length > 50) {
    throw httpError("At least one prompt response is required.", 400, "validation_error");
  }
  return {
    responses: responses.map((item) => {
      assertUuid(item?.promptId, "Invalid prompt id.");
      const responseText = typeof item?.responseText === "string" ? item.responseText.slice(0, 50000) : "";
      const submissionStatus = ["draft", "submitted"].includes(item?.submissionStatus) ? item.submissionStatus : "draft";
      return { promptId: item.promptId, responseText, submissionStatus };
    })
  };
}

// ---------------------------------------------------------------------------
// Caller / activity access
// ---------------------------------------------------------------------------

async function getCaller(context, user) {
  const rows = await adminRest(context, `profiles?select=id,role,full_name,email&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const profile = first(rows);
  if (!profile) throw httpError("Your account is not authorized for activities.", 403, "forbidden");
  return { id: user.id, role: String(profile.role || "").toLowerCase(), profile };
}

async function getActivityRow(context, activityId) {
  assertUuid(activityId, "Invalid activity id.");
  const rows = await adminRest(context, `mentor_assigned_activities?select=*&id=eq.${encodeURIComponent(activityId)}&limit=1`);
  const row = first(rows);
  if (!row) throw httpError("Activity not found.", 404, "not_found");
  return row;
}

async function assertAssignedStudent(context, caller, studentId) {
  if (caller.role === "admin") {
    const rows = await adminRest(context, `profiles?select=id,role&id=eq.${encodeURIComponent(studentId)}&limit=1`);
    const row = first(rows);
    if (!row || row.role !== "student") throw httpError("Student not found.", 404, "not_found");
    return;
  }
  if (caller.role !== "mentor") throw httpError("Only mentors can assign activities.", 403, "forbidden");
  const rows = await adminRest(
    context,
    `mentor_matches?select=id&mentor_id=eq.${encodeURIComponent(caller.id)}&student_id=eq.${encodeURIComponent(studentId)}&status=in.(${ACTIVE_MENTOR_MATCH_STATUSES.join(",")})&limit=1`
  );
  if (!first(rows)) throw httpError("You are not assigned to this student.", 403, "forbidden");
}

async function hydrateActivities(context, rows) {
  if (!rows.length) return [];
  const idList = rows.map((row) => row.id).join(",");
  const userIdList = [...new Set(rows.flatMap((row) => [row.mentor_id, row.student_id]).filter(Boolean))].join(",");

  const [submissions, feedback, profiles, prompts, promptResponses] = await Promise.all([
    adminRest(context, `activity_submissions?select=*&activity_id=in.(${idList})&order=created_at.desc`),
    adminRest(context, `activity_feedback?select=*&activity_id=in.(${idList})&order=created_at.desc`),
    adminRest(context, `profiles?select=id,full_name,role&id=in.(${userIdList})`),
    adminRest(context, `activity_essay_prompts?select=*&activity_id=in.(${idList})&order=display_order.asc`).catch(() => []),
    adminRest(context, `activity_prompt_responses?select=*&activity_id=in.(${idList})&order=created_at.asc`).catch(() => [])
  ]);

  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  const feedbackByActivity = {};
  const feedbackBySubmission = {};
  for (const row of feedback || []) {
    const item = mapFeedback(row, profileById);
    (feedbackByActivity[row.activity_id] ||= []).push(item);
    if (row.submission_id) (feedbackBySubmission[row.submission_id] ||= []).push(item);
  }
  const submissionsByActivity = {};
  for (const row of submissions || []) {
    (submissionsByActivity[row.activity_id] ||= []).push(mapSubmission(row, feedbackBySubmission[row.id] || []));
  }
  const promptsByActivity = {};
  for (const row of prompts || []) {
    (promptsByActivity[row.activity_id] ||= []).push({
      id: row.id,
      activityId: row.activity_id,
      promptText: row.prompt_text,
      optionalWordLimit: row.optional_word_limit,
      displayOrder: row.display_order
    });
  }
  const responsesByActivity = {};
  for (const row of promptResponses || []) {
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
  return rows
    .map((row) =>
      mapActivity(row, {
        submissions: submissionsByActivity[row.id] || [],
        feedback: feedbackByActivity[row.id] || [],
        prompts: promptsByActivity[row.id] || [],
        promptResponses: responsesByActivity[row.id] || [],
        profileById
      })
    )
    .sort(activitySort);
}

async function listAssignedStudents(context, caller) {
  if (!["mentor", "admin"].includes(caller.role)) return [];
  const mentorFilter = caller.role === "mentor" ? `&mentor_id=eq.${encodeURIComponent(caller.id)}` : "";
  const matches = await adminRest(
    context,
    `mentor_matches?select=student_id,mentor_id,status,created_at&status=in.(${ACTIVE_MENTOR_MATCH_STATUSES.join(",")})${mentorFilter}&order=created_at.desc`
  );
  const studentIds = [...new Set((matches || []).map((row) => row.student_id).filter(Boolean))];
  if (!studentIds.length) return [];
  const profiles = await adminRest(
    context,
    `profiles?select=id,full_name,preferred_name,grade_level,college_interests,plan_id,subscription_status&id=in.(${studentIds.join(",")})`
  );
  const students = await Promise.all(
    (profiles || []).map(async (profile) => {
      const balance = await getReviewCreditBalance(context, profile.id);
      return {
        id: profile.id,
        name: profile.preferred_name || profile.full_name || "Student",
        grade: profile.grade_level || "",
        colleges: Array.isArray(profile.college_interests) ? profile.college_interests : [],
        plan: profile.plan_id || "basic",
        essaySupportOnly: isEssaySupportOnlyStudent({ plan: profile.plan_id, subscriptionStatus: profile.subscription_status }),
        reviewCredits: { purchased: balance.purchased, assigned: balance.assigned, remaining: balance.remaining }
      };
    })
  );
  return students.sort((a, b) => a.name.localeCompare(b.name));
}

async function notify(context, userId, title, body, link) {
  try {
    await adminRest(context, "notifications", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, title, body, unread: true, link })
    });
  } catch (error) {
    console.error("[activities-worker-notification]", { userId, title, message: error?.message });
  }
}

// ---------------------------------------------------------------------------
// Route handlers (ported from the Express-style routing in mentorActivitiesApi.js)
// ---------------------------------------------------------------------------

async function listActivities(context, caller, statusFilter) {
  let filter = "";
  if (caller.role === "student") filter = `&student_id=eq.${encodeURIComponent(caller.id)}`;
  else if (caller.role === "mentor") filter = `&mentor_id=eq.${encodeURIComponent(caller.id)}`;
  else if (caller.role !== "admin") throw httpError("Activities are not available for this account.", 403, "forbidden");
  const statusQuery = statusFilter && ACTIVITY_STATUSES.includes(statusFilter) ? `&status=eq.${encodeURIComponent(statusFilter)}` : "";
  const rows = await adminRest(context, `mentor_assigned_activities?select=*${filter}${statusQuery}&order=created_at.desc`);
  return hydrateActivities(context, rows || []);
}

async function createActivity(context, caller, body) {
  if (!["mentor", "admin"].includes(caller.role)) throw httpError("Only mentors can assign activities.", 403, "forbidden");
  const input = parseActivityCreate(body);
  await assertAssignedStudent(context, caller, input.studentId);

  const studentRows = await adminRest(
    context,
    `profiles?select=id,plan_id,subscription_status&id=eq.${encodeURIComponent(input.studentId)}&limit=1`
  );
  const student = first(studentRows);
  if (!student) throw httpError("Student not found.", 404, "not_found");

  const balance = await getReviewCreditBalance(context, input.studentId);
  const essaySupportOnly = isEssaySupportOnlyStudent({ plan: student.plan_id, subscriptionStatus: student.subscription_status });
  if (essaySupportOnly && !ESSAY_SUPPORT_ACTIVITY_TYPES.includes(input.activityType)) {
    throw httpError("This activity type is not available for this student\u2019s plan.", 403, "activity_type_not_available");
  }

  const isEssayReview = ESSAY_SUPPORT_ACTIVITY_TYPES.includes(input.activityType);
  if (essaySupportOnly && isEssayReview && balance.remaining < 1) {
    throw httpError("This student has no Essay Support review credits remaining.", 409, "no_review_credits");
  }
  const usesEssayCredits = isEssayReview && balance.remaining > 0;

  const prompts =
    input.activityType === "supplemental_essay"
      ? input.prompts?.length
        ? input.prompts
        : input.essayPrompt
          ? [{ promptText: input.essayPrompt, optionalWordLimit: input.wordLimit }]
          : []
      : [];
  if (input.activityType === "supplemental_essay") {
    if (!input.collegeName) throw httpError("College is required for supplemental essay reviews.", 400, "college_required");
    if (!prompts.length) throw httpError("Add at least one supplemental essay prompt.", 400, "prompt_required");
  }

  const insertRows = await adminRest(context, "mentor_assigned_activities", {
    method: "POST",
    body: JSON.stringify({
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
    })
  });
  const data = first(insertRows);
  if (!data) throw httpError("Could not assign this activity.", 500, "database_error");

  try {
    if (prompts.length) {
      await adminRest(context, "activity_essay_prompts", {
        method: "POST",
        body: JSON.stringify(
          prompts.map((prompt, displayOrder) => ({
            activity_id: data.id,
            prompt_text: prompt.promptText,
            optional_word_limit: prompt.optionalWordLimit || null,
            display_order: displayOrder
          }))
        )
      });
    }
    if (usesEssayCredits) {
      await reserveEssayReviewCredit(context, { studentUserId: input.studentId, activityId: data.id, createdByUserId: caller.id });
    }
  } catch (createError) {
    await adminRest(context, `activity_essay_prompts?activity_id=eq.${encodeURIComponent(data.id)}`, { method: "DELETE" }).catch(() => {});
    await adminRest(context, `mentor_assigned_activities?id=eq.${encodeURIComponent(data.id)}`, { method: "DELETE" }).catch(() => {});
    throw createError;
  }

  await notify(context, input.studentId, "New mentor activity", `Your mentor assigned you a new activity: ${input.title}.`, "/dashboard/student/overview");
  return (await hydrateActivities(context, [data]))[0];
}

async function updateActivity(context, caller, activityId, body) {
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity, { writeAsMentor: true });
  if (activity.status === "completed") throw httpError("Completed activities cannot be edited.", 409, "activity_completed");
  const input = parseActivityUpdate(body);
  if (!Object.keys(input).length) throw httpError("No activity changes were provided.", 400, "validation_error");
  const fieldMap = {
    activityType: "activity_type",
    title: "title",
    collegeName: "college_name",
    essayPrompt: "essay_prompt",
    wordLimit: "word_limit",
    instructions: "instructions",
    dueDate: "due_date",
    allowedSubmissionMethod: "allowed_submission_method"
  };
  const payload = {};
  for (const [key, dbKey] of Object.entries(fieldMap)) {
    if (input[key] !== undefined) payload[dbKey] = input[key];
  }
  const rows = await adminRest(context, `mentor_assigned_activities?id=eq.${encodeURIComponent(activity.id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  const updated = first(rows);
  if (!updated) throw httpError("Could not update this activity.", 409, "conflict");
  return (await hydrateActivities(context, [updated]))[0];
}

async function verifyStoredFile(context, bucket, activity, input, maxBytes) {
  assertStoragePath(activity, input.storagePath);
  const parts = input.storagePath.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");
  const list = await listStorageObjects(context, bucket, folder, { search: fileName, limit: 10 });
  const object = (list || []).find((item) => item.name === fileName);
  if (!object) throw httpError("The uploaded file could not be found. Upload it again.", 400, "file_not_found");
  const size = Number(object.metadata?.size || input.fileSize);
  const mime = object.metadata?.mimetype || input.fileMimeType;
  const resolved = resolveActivityFileType(input.originalFileName, mime);
  if (!resolved) throw httpError("Only PDF, DOC, and DOCX files are supported.", 400, "unsupported_file_type");
  if (size > maxBytes) throw httpError(`Files must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`, 413, "file_too_large");
  return { size, mime };
}

async function saveSubmission(context, caller, activityId, body, idempotencyKeyHeader, config) {
  if (caller.role !== "student") throw httpError("Only students can submit activity work.", 403, "forbidden");
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity);
  const input = parseSubmission(body);
  assertSubmissionPayload(activity, input);
  let verifiedFile = null;
  if (input.submissionMethod === "file_upload") {
    verifiedFile = await verifyStoredFile(context, config.bucket, activity, input, config.maxBytes);
  }

  const safeIdempotencyKey = String(idempotencyKeyHeader || "").trim().slice(0, 120) || null;
  if (!input.isDraft && !safeIdempotencyKey) throw httpError("A submission idempotency key is required.", 400, "idempotency_key_required");

  if (!input.isDraft && safeIdempotencyKey) {
    const priorRows = await adminRest(
      context,
      `activity_submissions?select=*&idempotency_key=eq.${encodeURIComponent(safeIdempotencyKey)}&activity_id=eq.${encodeURIComponent(activity.id)}&student_id=eq.${encodeURIComponent(caller.id)}&limit=1`
    );
    const prior = first(priorRows);
    if (prior) return { submission: mapSubmission(prior), activity: (await hydrateActivities(context, [activity]))[0], duplicate: true };
  }

  const draftRows = await adminRest(
    context,
    `activity_submissions?select=*&activity_id=eq.${encodeURIComponent(activity.id)}&student_id=eq.${encodeURIComponent(caller.id)}&is_draft=eq.true&order=updated_at.desc&limit=1`
  );
  const draft = first(draftRows);
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

  let resultRow = null;
  try {
    if (draft) {
      const rows = await adminRest(context, `activity_submissions?id=eq.${encodeURIComponent(draft.id)}&is_draft=eq.true`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      resultRow = first(rows);
    } else {
      const rows = await adminRest(context, "activity_submissions", { method: "POST", body: JSON.stringify(payload) });
      resultRow = first(rows);
    }
  } catch (error) {
    if (error?.status === 409 && safeIdempotencyKey) {
      const dupRows = await adminRest(
        context,
        `activity_submissions?select=*&idempotency_key=eq.${encodeURIComponent(safeIdempotencyKey)}&activity_id=eq.${encodeURIComponent(activity.id)}&student_id=eq.${encodeURIComponent(caller.id)}&limit=1`
      );
      const duplicate = first(dupRows);
      if (duplicate) return { submission: mapSubmission(duplicate), activity: (await hydrateActivities(context, [activity]))[0], duplicate: true };
    }
    throw error;
  }
  if (!resultRow) throw httpError("Could not save this submission.", 500, "database_error");

  const nextStatus = input.isDraft ? (activity.status === "needs_revision" ? "needs_revision" : "in_progress") : "submitted";
  const updatedRows = await adminRest(context, `mentor_assigned_activities?id=eq.${encodeURIComponent(activity.id)}&status=neq.completed`, {
    method: "PATCH",
    body: JSON.stringify({ status: nextStatus, updated_at: now })
  });
  const updatedActivity = first(updatedRows);
  if (!updatedActivity) throw httpError("The submission was saved, but the activity status could not be updated.", 500, "database_error");
  if (!input.isDraft) {
    await notify(context, activity.mentor_id, "Activity submitted", `${caller.profile.full_name || "A student"} submitted ${activity.title}.`, "/dashboard/mentor/overview");
  }
  return { submission: mapSubmission(resultRow), activity: (await hydrateActivities(context, [updatedActivity]))[0], duplicate: false };
}

async function createUploadUrl(context, caller, activityId, body, config) {
  if (caller.role !== "student") throw httpError("Only students can upload activity files.", 403, "forbidden");
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity);
  if (activity.status === "completed") throw httpError("This activity is already completed.", 409, "activity_completed");
  if (activity.allowed_submission_method === "document_link") throw httpError("File uploads are not allowed for this activity.", 400, "submission_method_not_allowed");
  const input = parseFileSchema(body);
  if (input.fileSize > config.maxBytes) throw httpError(`Files must be ${Math.floor(config.maxBytes / 1024 / 1024)} MB or smaller.`, 413, "file_too_large");
  const resolved = resolveActivityFileType(input.fileName, input.fileMimeType);
  if (!resolved) throw httpError("Only PDF, DOC, and DOCX files are supported.", 400, "unsupported_file_type");
  const safeName = sanitizeActivityFileName(input.fileName);
  const path = `${caller.id}/${activity.id}/${crypto.randomUUID()}-${safeName}`;
  const { signedUrl, token } = await createSignedUploadUrl(context, config.bucket, path);
  return { path, signedUrl, token, fileName: safeName, maxBytes: config.maxBytes };
}

async function createFileUrl(context, caller, activityId, body, config) {
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity);
  const input = parseFileUrl(body);
  const rows = await adminRest(
    context,
    `activity_submissions?select=*&id=eq.${encodeURIComponent(input.submissionId)}&activity_id=eq.${encodeURIComponent(activity.id)}&limit=1`
  );
  const submission = first(rows);
  if (!submission?.storage_path) throw httpError("Submission file not found.", 404, "not_found");
  assertStoragePath(activity, submission.storage_path);
  const signedUrl = await createSignedDownloadUrl(context, config.bucket, submission.storage_path, 300, submission.original_file_name || "activity-document");
  return { signedUrl, expiresIn: 300 };
}

async function removeDraftFile(context, caller, activityId, body, config) {
  if (caller.role !== "student") throw httpError("Only students can remove draft files.", 403, "forbidden");
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity);
  const input = parseFilePath(body);
  assertStoragePath(activity, input.storagePath);
  const references = await adminRest(
    context,
    `activity_submissions?select=id,is_draft&activity_id=eq.${encodeURIComponent(activity.id)}&storage_path=eq.${encodeURIComponent(input.storagePath)}`
  );
  if ((references || []).some((item) => !item.is_draft)) throw httpError("Submitted revision files cannot be removed.", 409, "submitted_file");
  const draftIds = (references || []).map((item) => item.id);
  if (draftIds.length) {
    await adminRest(context, `activity_submissions?id=in.(${draftIds.join(",")})&student_id=eq.${encodeURIComponent(caller.id)}`, { method: "DELETE" });
  }
  await removeStorageObjects(context, config.bucket, [input.storagePath]);
  return { removed: true };
}

async function addFeedback(context, caller, activityId, body) {
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity, { writeAsMentor: true });
  const input = parseFeedback(body);
  if (input.submissionId) {
    const rows = await adminRest(
      context,
      `activity_submissions?select=id&id=eq.${encodeURIComponent(input.submissionId)}&activity_id=eq.${encodeURIComponent(activity.id)}&limit=1`
    );
    if (!first(rows)) throw httpError("Submission not found.", 404, "not_found");
  }
  const rows = await adminRest(context, "activity_feedback", {
    method: "POST",
    body: JSON.stringify({ activity_id: activity.id, submission_id: input.submissionId || null, mentor_id: caller.id, feedback_text: input.feedbackText })
  });
  const data = first(rows);
  if (!data) throw httpError("Could not save feedback.", 500, "database_error");
  await notify(context, activity.student_id, "New mentor feedback", `Your mentor left feedback on ${activity.title}.`, "/dashboard/student/overview");
  return mapFeedback(data, { [caller.id]: caller.profile });
}

async function reviewActivity(context, caller, activityId, body) {
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity, { writeAsMentor: true });
  if (activity.status === "completed") throw httpError("This activity is already completed.", 409, "activity_completed");
  const input = parseReview(body);
  if (!input.submissionId) throw httpError("Choose a submitted revision to review.", 400, "submission_required");
  const submissionRows = await adminRest(
    context,
    `activity_submissions?select=id&id=eq.${encodeURIComponent(input.submissionId)}&activity_id=eq.${encodeURIComponent(activity.id)}&is_draft=eq.false&limit=1`
  );
  if (!first(submissionRows)) throw httpError("Submitted revision not found.", 404, "not_found");
  if (input.feedbackText) {
    await adminRest(context, "activity_feedback", {
      method: "POST",
      body: JSON.stringify({ activity_id: activity.id, submission_id: input.submissionId || null, mentor_id: caller.id, feedback_text: input.feedbackText })
    });
  }
  const completedAt = input.status === "completed" ? new Date().toISOString() : null;
  const rows = await adminRest(context, `mentor_assigned_activities?id=eq.${encodeURIComponent(activity.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: input.status, completed_at: completedAt, updated_at: new Date().toISOString() })
  });
  const updated = first(rows);
  if (!updated) throw httpError("Could not update this activity review.", 500, "database_error");
  const bodyText =
    input.status === "needs_revision"
      ? `Your submission for ${activity.title} is ready for revision.`
      : `Your mentor marked ${activity.title} as completed.`;
  await notify(context, activity.student_id, input.status === "needs_revision" ? "Revision requested" : "Activity completed", bodyText, "/dashboard/student/overview");
  return (await hydrateActivities(context, [updated]))[0];
}

async function savePromptResponses(context, caller, activityId, body) {
  if (caller.role !== "student") throw httpError("Only students can save prompt responses.", 403, "forbidden");
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity);
  if (activity.status === "completed") throw httpError("This activity is already completed.", 409, "activity_completed");
  const input = parsePromptResponses(body);
  const promptIds = input.responses.map((response) => response.promptId);
  if (new Set(promptIds).size !== promptIds.length) throw httpError("Each essay prompt can only have one response.", 400, "duplicate_prompt");
  const prompts = await adminRest(context, `activity_essay_prompts?select=id&activity_id=eq.${encodeURIComponent(activity.id)}`);
  const activityPromptIds = new Set((prompts || []).map((prompt) => prompt.id));
  if (promptIds.some((id) => !activityPromptIds.has(id))) throw httpError("One or more prompt responses do not belong to this activity.", 400, "invalid_prompt");

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
  await adminRest(context, "activity_prompt_responses?on_conflict=prompt_id,student_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows)
  });
  const allSubmitted = input.responses.length === activityPromptIds.size && input.responses.every((response) => response.submissionStatus === "submitted");
  const updatedRows = await adminRest(context, `mentor_assigned_activities?id=eq.${encodeURIComponent(activity.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: allSubmitted ? "submitted" : "in_progress", updated_at: now })
  });
  const updated = first(updatedRows);
  if (!updated) throw httpError("Prompt responses were saved, but activity status could not be updated.", 500, "database_error");
  return (await hydrateActivities(context, [updated]))[0];
}

async function deleteActivity(context, caller, activityId) {
  const activity = await getActivityRow(context, activityId);
  assertActivityAccessRow(caller, activity, { writeAsMentor: true });
  const [submissionRows, feedbackRows] = await Promise.all([
    adminRest(context, `activity_submissions?select=id&activity_id=eq.${encodeURIComponent(activity.id)}&is_draft=eq.false&limit=1`),
    adminRest(context, `activity_feedback?select=id&activity_id=eq.${encodeURIComponent(activity.id)}&limit=1`)
  ]);
  const eligibleForRestore =
    ["not_started", "in_progress"].includes(activity.status) && !(submissionRows || []).length && !(feedbackRows || []).length;

  await adminRest(context, `mentor_assigned_activities?id=eq.${encodeURIComponent(activity.id)}`, { method: "DELETE" });
  let restored = null;
  if (ESSAY_SUPPORT_ACTIVITY_TYPES.includes(activity.activity_type)) {
    restored = await restoreEssayReviewCreditOnCancel(context, {
      studentUserId: activity.student_id,
      activityId: activity.id,
      createdByUserId: caller.id,
      eligible: eligibleForRestore
    });
  }
  return { deleted: true, creditRestored: Boolean(restored) };
}

function activityConfig(context) {
  const configuredMax = Number(context.env?.MENTOR_ACTIVITY_MAX_FILE_BYTES);
  return {
    bucket: context.env?.MENTOR_ACTIVITY_STORAGE_BUCKET || DEFAULT_ACTIVITY_BUCKET,
    maxBytes: Number.isFinite(configuredMax) && configuredMax > 0 ? Math.min(configuredMax, DEFAULT_MAX_FILE_BYTES) : DEFAULT_MAX_FILE_BYTES
  };
}

/** Entry point for functions/api/activities/index.js and functions/api/activities/[[path]].js. */
export async function handleActivities(context) {
  return runAuthenticated(context, async ({ user }) => {
    const caller = await getCaller(context, user);
    const config = activityConfig(context);
    const url = new URL(context.request.url);
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .slice(2)
      .map((segment) => decodeURIComponent(segment));
    const [activityId, action] = segments;
    const method = context.request.method;

    if (!activityId && method === "GET") {
      const activities = await listActivities(context, caller, url.searchParams.get("status"));
      const students = await listAssignedStudents(context, caller);
      return json({ activities, students, role: caller.role });
    }
    if (!activityId && method === "POST") {
      const activity = await createActivity(context, caller, await readJsonBody(context.request));
      return json({ activity }, 201);
    }
    if (activityId === "students" && method === "GET") {
      return json({ students: await listAssignedStudents(context, caller) });
    }
    if (activityId && !action && method === "GET") {
      const activity = await getActivityRow(context, activityId);
      assertActivityAccessRow(caller, activity);
      return json({ activity: (await hydrateActivities(context, [activity]))[0] });
    }
    if (activityId && !action && method === "PATCH") {
      return json({ activity: await updateActivity(context, caller, activityId, await readJsonBody(context.request)) });
    }
    if (activityId && !action && method === "DELETE") {
      return json(await deleteActivity(context, caller, activityId));
    }
    if (action === "prompt-responses" && method === "POST") {
      return json({ activity: await savePromptResponses(context, caller, activityId, await readJsonBody(context.request)) });
    }
    if (action === "submissions" && method === "POST") {
      const idempotencyKey = context.request.headers.get("Idempotency-Key");
      const result = await saveSubmission(context, caller, activityId, await readJsonBody(context.request), idempotencyKey, config);
      return json(result, result.duplicate ? 200 : 201);
    }
    if (action === "upload-url" && method === "POST") {
      return json(await createUploadUrl(context, caller, activityId, await readJsonBody(context.request), config), 201);
    }
    if (action === "file-url" && method === "POST") {
      return json(await createFileUrl(context, caller, activityId, await readJsonBody(context.request), config));
    }
    if (action === "file" && method === "DELETE") {
      return json(await removeDraftFile(context, caller, activityId, await readJsonBody(context.request), config));
    }
    if (action === "feedback" && method === "POST") {
      return json({ feedback: await addFeedback(context, caller, activityId, await readJsonBody(context.request)) }, 201);
    }
    if (action === "review" && method === "PATCH") {
      return json({ activity: await reviewActivity(context, caller, activityId, await readJsonBody(context.request)) });
    }
    return json({ error: "method_not_allowed", message: "Activity route does not support this method." }, 405, { Allow: "GET, POST, PATCH, DELETE" });
  });
}

/** Entry point for functions/api/students/[id].js. */
export async function handleStudentAccess(context) {
  return runAuthenticated(context, async ({ user }) => {
    if (context.request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const studentId = context.params?.id;
    if (!studentId || !UUID_RE.test(studentId)) throw httpError("Student not found.", 404, "not_found");

    const caller = await getCaller(context, user);
    if (caller.id !== studentId) {
      if (caller.role === "mentor") {
        const rows = await adminRest(
          context,
          `mentor_matches?select=id&mentor_id=eq.${encodeURIComponent(caller.id)}&student_id=eq.${encodeURIComponent(studentId)}&status=in.(${ACTIVE_MENTOR_MATCH_STATUSES.join(",")})&limit=1`
        );
        if (!first(rows)) throw httpError("You are not assigned to this student.", 403, "forbidden");
      } else if (caller.role !== "admin") {
        throw httpError("You do not have access to this student.", 403, "forbidden");
      }
    }

    const rows = await adminRest(
      context,
      `profiles?select=id,full_name,preferred_name,role,grade_level,school,college_interests,target_majors,avatar_url,plan_id,subscription_status&id=eq.${encodeURIComponent(studentId)}&limit=1`
    );
    const profile = first(rows);
    if (!profile || String(profile.role || "").toLowerCase() !== "student") throw httpError("Student not found.", 404, "not_found");

    return json({
      student: {
        id: profile.id,
        name: profile.preferred_name || profile.full_name || "Student",
        fullName: profile.full_name || "",
        grade: profile.grade_level || "",
        school: profile.school || "",
        colleges: Array.isArray(profile.college_interests) ? profile.college_interests : [],
        majors: Array.isArray(profile.target_majors) ? profile.target_majors : [],
        avatarUrl: profile.avatar_url || null,
        plan: profile.plan_id || "basic"
      }
    });
  });
}
