import { api } from "./auth.js";
import { getSupabase } from "./supabase.js";
import {
  addDemoActivityFeedback,
  createDemoMentorActivity,
  getDemoActivityFileUrl,
  getDemoMentorActivity,
  isDemoActivityUser,
  listDemoMentorActivities,
  removeDemoActivityDraftFile,
  requestDemoActivityUpload,
  reviewDemoMentorActivity,
  saveDemoActivitySubmission,
  storeDemoActivityUpload,
  updateDemoMentorActivity
} from "./demoMentorActivities.js";

export const ACTIVITY_TYPE_OPTIONS = [
  { value: "personal_statement", label: "Personal Statement", defaultTitle: "Personal Statement Draft" },
  { value: "supplemental_essay", label: "Supplemental Essay", defaultTitle: "Supplemental Essay Draft" },
  { value: "additional_essay", label: "Additional Essay", defaultTitle: "Additional Essay Draft" },
  { value: "activities_list", label: "Activities List", defaultTitle: "Common App Activities List" },
  { value: "resume", label: "Résumé", defaultTitle: "Résumé Review" },
  { value: "custom_activity", label: "Custom Activity", defaultTitle: "Writing Activity" }
];

export const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  needs_revision: "Needs Revision",
  completed: "Completed",
  overdue: "Overdue"
};

export const SUBMISSION_METHOD_OPTIONS = [
  { value: "document_link", label: "Paste a document link" },
  { value: "file_upload", label: "Upload a file" }
];

export const ACTIVITY_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACTIVITY_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

async function activityRequest(path, options = {}) {
  const sessionResult = await getSupabase()?.auth.getSession();
  const token = sessionResult?.data?.session?.access_token;
  if (!token) return api(path, options);
  return api(path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
}

export function activityTypeLabel(type) {
  return ACTIVITY_TYPE_OPTIONS.find((item) => item.value === type)?.label || "Activity";
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || "Not Started";
}

export function activityPrimaryAction(status) {
  if (status === "needs_revision") return "Revise Submission";
  if (status === "submitted" || status === "completed") return "View Submission";
  if (status === "in_progress") return "Continue";
  return "Open Activity";
}

export function resolveActivityFileMime(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  const expected = MIME_BY_EXTENSION[extension];
  if (!expected) return null;
  if (file?.type && file.type !== expected) return null;
  return expected;
}

export function validateActivityFile(file, maxBytes = ACTIVITY_MAX_FILE_BYTES) {
  if (!file) return "Choose a PDF, DOC, or DOCX file.";
  if (!resolveActivityFileMime(file)) return "Only PDF, DOC, and DOCX files are supported.";
  if (file.size > maxBytes) return `Files must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`;
  return null;
}

export function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function isValidDocumentLink(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function listMentorActivities(status, user) {
  if (isDemoActivityUser(user)) return listDemoMentorActivities(user, status);
  const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return activityRequest(`/api/activities${query}`);
}

export function listStudentActivities(user) {
  if (isDemoActivityUser(user)) return listDemoMentorActivities(user);
  return activityRequest("/api/activities");
}

export function getMentorActivity(id, user) {
  if (isDemoActivityUser(user)) return getDemoMentorActivity(user, id);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}`);
}

export function createMentorActivity(payload, user) {
  if (isDemoActivityUser(user)) return createDemoMentorActivity(user, payload);
  return activityRequest("/api/activities", { method: "POST", body: JSON.stringify(payload) });
}

export function updateMentorActivity(id, payload, user) {
  if (isDemoActivityUser(user)) return updateDemoMentorActivity(user, id, payload);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function saveActivitySubmission(id, payload, idempotencyKey, user) {
  if (isDemoActivityUser(user)) return saveDemoActivitySubmission(user, id, payload, idempotencyKey);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}/submissions`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(payload)
  });
}

export function requestActivityUpload(id, file, user) {
  const fileMimeType = resolveActivityFileMime(file);
  if (isDemoActivityUser(user)) return requestDemoActivityUpload(user, id, file);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}/upload-url`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, fileMimeType, fileSize: file.size })
  });
}

export function uploadActivityFile(signedUrl, file, mimeType, onProgress) {
  if (signedUrl.startsWith("demo-upload:")) return storeDemoActivityUpload(signedUrl, file, onProgress);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("The file upload failed. Try again."));
    });
    xhr.addEventListener("error", () => reject(new Error("The file upload failed. Check your connection and try again.")));
    xhr.addEventListener("abort", () => reject(new Error("The file upload was cancelled.")));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file, file.name);
    xhr.send(body);
  });
}

export function removeActivityDraftFile(id, storagePath, user) {
  if (isDemoActivityUser(user)) return removeDemoActivityDraftFile(user, id, storagePath);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}/file`, {
    method: "DELETE",
    body: JSON.stringify({ storagePath })
  });
}

export function getActivityFileUrl(id, submissionId, user) {
  if (isDemoActivityUser(user)) return getDemoActivityFileUrl(user, id, submissionId);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}/file-url`, {
    method: "POST",
    body: JSON.stringify({ submissionId })
  });
}

export function addActivityFeedback(id, payload, user) {
  if (isDemoActivityUser(user)) return addDemoActivityFeedback(user, id, payload);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}/feedback`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function reviewMentorActivity(id, payload, user) {
  if (isDemoActivityUser(user)) return reviewDemoMentorActivity(user, id, payload);
  return activityRequest(`/api/activities/${encodeURIComponent(id)}/review`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
