/**
 * Application-component review requests (async Basic+ admissions support).
 * Credits are counted client-side from non-cancelled monthly submissions.
 */

import { getSupabase } from "./supabase.js";

export const APPLICATION_REVIEW_COMPONENT_TYPES = [
  {
    id: "personal_statement",
    label: "Personal statement / essay",
    description: "One personal statement or essay up to 650 words"
  },
  {
    id: "supplemental_essay",
    label: "Supplemental essay / short answers",
    description: "One supplemental essay or short-answer set of comparable length"
  },
  {
    id: "activities_list",
    label: "Activities list",
    description: "One activities list"
  },
  {
    id: "resume",
    label: "Résumé",
    description: "One résumé"
  },
  {
    id: "school_list",
    label: "School list",
    description: "One school list"
  },
  {
    id: "scholarship_response",
    label: "Scholarship response",
    description: "One scholarship response"
  },
  {
    id: "other",
    label: "Other application component",
    description: "One comparable admissions document or application component"
  }
];

export const APPLICATION_REVIEW_STATUS = {
  SUBMITTED: "submitted",
  IN_REVIEW: "in_review",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

export const APPLICATION_REVIEW_STATUS_LABELS = {
  submitted: "Submitted",
  in_review: "In Review",
  completed: "Completed",
  cancelled: "Cancelled"
};

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function requireUserId(userId) {
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

function isMissingTableError(error) {
  const message = String(error?.message || error || "");
  return /application_review_requests/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

export function getComponentTypeLabel(componentType) {
  return APPLICATION_REVIEW_COMPONENT_TYPES.find((item) => item.id === componentType)?.label || "Application component";
}

export function getReviewStatusLabel(status) {
  return APPLICATION_REVIEW_STATUS_LABELS[status] || status || "Submitted";
}

export function mapApplicationReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentUserId: row.student_user_id || row.studentUserId,
    mentorUserId: row.mentor_user_id || row.mentorUserId || null,
    studentName: row.student_name || row.studentName || "Student",
    componentType: row.component_type || row.componentType,
    title: row.title || getComponentTypeLabel(row.component_type || row.componentType),
    contentText: row.content_text || row.contentText || "",
    fileName: row.file_name || row.fileName || null,
    studentNotes: row.student_notes || row.studentNotes || "",
    status: row.status || APPLICATION_REVIEW_STATUS.SUBMITTED,
    feedbackText: row.feedback_text || row.feedbackText || "",
    editedFileName: row.edited_file_name || row.editedFileName || null,
    editedContentText: row.edited_content_text || row.editedContentText || "",
    submittedAt: row.submitted_at || row.submittedAt || row.created_at || row.createdAt,
    completedAt: row.completed_at || row.completedAt || null,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

export async function listApplicationReviewsForStudent(userId) {
  const id = requireUserId(userId);
  try {
    const { data, error } = await db()
      .from("application_review_requests")
      .select("*")
      .eq("student_user_id", id)
      .order("submitted_at", { ascending: false });
    if (error) {
      if (isMissingTableError(error)) return { reviews: [], error: null, missingTable: true };
      return { reviews: [], error: error.message };
    }
    return { reviews: (data || []).map(mapApplicationReview), error: null };
  } catch (error) {
    if (isMissingTableError(error)) return { reviews: [], error: null, missingTable: true };
    return { reviews: [], error: error?.message || "Could not load application reviews." };
  }
}

export async function listApplicationReviewsForMentor(mentorUserId) {
  const id = requireUserId(mentorUserId);
  try {
    const { data, error } = await db()
      .from("application_review_requests")
      .select("*")
      .eq("mentor_user_id", id)
      .order("submitted_at", { ascending: false });
    if (error) {
      if (isMissingTableError(error)) return { reviews: [], error: null, missingTable: true };
      return { reviews: [], error: error.message };
    }
    return { reviews: (data || []).map(mapApplicationReview), error: null };
  } catch (error) {
    if (isMissingTableError(error)) return { reviews: [], error: null, missingTable: true };
    return { reviews: [], error: error?.message || "Could not load application reviews." };
  }
}

export async function createApplicationReviewRequest(userId, payload) {
  const id = requireUserId(userId);
  const now = new Date().toISOString();
  const insert = {
    student_user_id: id,
    mentor_user_id: payload.mentorUserId || null,
    component_type: payload.componentType,
    title: payload.title || getComponentTypeLabel(payload.componentType),
    content_text: payload.contentText || "",
    file_name: payload.fileName || null,
    student_notes: payload.studentNotes || "",
    status: APPLICATION_REVIEW_STATUS.SUBMITTED,
    submitted_at: now,
    updated_at: now
  };

  try {
    const { data, error } = await db().from("application_review_requests").insert(insert).select().single();
    if (error) {
      if (isMissingTableError(error)) {
        return {
          review: mapApplicationReview({
            id: `local-review-${Date.now()}`,
            ...insert,
            created_at: now
          }),
          error: null,
          localOnly: true
        };
      }
      return { review: null, error: error.message };
    }
    return { review: mapApplicationReview(data), error: null };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        review: mapApplicationReview({
          id: `local-review-${Date.now()}`,
          ...insert,
          created_at: now
        }),
        error: null,
        localOnly: true
      };
    }
    return { review: null, error: error?.message || "Could not submit review request." };
  }
}

export async function updateApplicationReviewRequest(actorUserId, reviewId, fields) {
  requireUserId(actorUserId);
  if (!reviewId) return { review: null, error: "Missing review id." };

  const patch = { updated_at: new Date().toISOString() };
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.feedbackText !== undefined) patch.feedback_text = fields.feedbackText;
  if (fields.editedFileName !== undefined) patch.edited_file_name = fields.editedFileName;
  if (fields.editedContentText !== undefined) patch.edited_content_text = fields.editedContentText;
  if (fields.status === APPLICATION_REVIEW_STATUS.COMPLETED) {
    patch.completed_at = fields.completedAt || new Date().toISOString();
  }

  try {
    const { data, error } = await db()
      .from("application_review_requests")
      .update(patch)
      .eq("id", reviewId)
      .select()
      .single();
    if (error) {
      if (isMissingTableError(error) || String(reviewId).startsWith("local-review-")) {
        return { review: null, error: null, localOnly: true, patch: fields };
      }
      return { review: null, error: error.message };
    }
    return { review: mapApplicationReview(data), error: null };
  } catch (error) {
    if (isMissingTableError(error) || String(reviewId).startsWith("local-review-")) {
      return { review: null, error: null, localOnly: true, patch: fields };
    }
    return { review: null, error: error?.message || "Could not update review request." };
  }
}
