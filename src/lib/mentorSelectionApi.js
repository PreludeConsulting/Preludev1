import { getSupabase } from "./supabase.js";

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("You must be signed in to continue.");
  }
  return session.access_token;
}

async function mentorSelectionApi(path, options = {}) {
  const token = await getAccessToken();
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function loadMentorSelectionState() {
  return mentorSelectionApi("/api/onboarding/mentor-selection");
}

export async function saveMentorSelection({ selectedMentorId = null } = {}) {
  return mentorSelectionApi("/api/onboarding/mentor-selection", {
    method: "POST",
    body: JSON.stringify({ selectedMentorId })
  });
}

export async function loadAdminMentorReviewQueue() {
  return mentorSelectionApi("/api/admin/mentor-review");
}

export async function assignMentorAsAdmin(studentId, mentorId) {
  return mentorSelectionApi(`/api/admin/mentor-review/${encodeURIComponent(studentId)}/assign`, {
    method: "POST",
    body: JSON.stringify({ mentorId })
  });
}
