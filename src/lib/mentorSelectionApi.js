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
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const error = new Error("The Matching Team data service returned an invalid response. The Cloudflare Function may not be deployed.");
    error.status = 502;
    error.payload = { error: "matching_api_invalid_response" };
    throw error;
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    const error = new Error("The Matching Team data service returned an invalid response.");
    error.status = 502;
    error.payload = { error: "matching_api_invalid_response" };
    throw error;
  }
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

export async function checkMatchingTeamAccess() {
  const payload = await mentorSelectionApi("/api/admin/mentor-review/access");
  if (payload?.allowed !== true) {
    const error = new Error("Matching Team access required.");
    error.status = 403;
    error.payload = payload;
    throw error;
  }
  return payload;
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
