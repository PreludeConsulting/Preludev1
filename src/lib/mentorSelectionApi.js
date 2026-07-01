import { getSupabase } from "./supabase.js";
import { loadMentorSelectionStateDirect, saveMentorSelectionDirect } from "./preludeMatchService.js";

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
  return { token: session.access_token, userId: session.user.id };
}

async function mentorSelectionApi(path, options = {}) {
  const { token } = await getAccessToken();
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
  try {
    return await mentorSelectionApi("/api/onboarding/mentor-selection");
  } catch {
    const { userId } = await getAccessToken();
    return loadMentorSelectionStateDirect(userId);
  }
}

export async function saveMentorSelection({ selectedMentorId = null } = {}) {
  try {
    return await mentorSelectionApi("/api/onboarding/mentor-selection", {
      method: "POST",
      body: JSON.stringify({ selectedMentorId })
    });
  } catch {
    const { userId } = await getAccessToken();
    return saveMentorSelectionDirect(userId, { selectedMentorId });
  }
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

export async function checkMatchingTeamAccess() {
  return mentorSelectionApi("/api/admin/mentor-review/access");
}

export async function loadMatchingTeamQueue() {
  return mentorSelectionApi("/api/admin/mentor-review");
}

export async function assignMentorAsMatchingTeam(studentId, mentorId) {
  return mentorSelectionApi(`/api/admin/mentor-review/${encodeURIComponent(studentId)}/assign`, {
    method: "POST",
    body: JSON.stringify({ mentorId })
  });
}

export async function removeMentorAsMatchingTeam(studentId) {
  return mentorSelectionApi(`/api/admin/mentor-review/${encodeURIComponent(studentId)}/assign`, {
    method: "DELETE"
  });
}
