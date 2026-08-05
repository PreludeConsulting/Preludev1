import { getSupabase } from "./supabase.js";

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export async function listMentorProfileApprovals() {
  const { data, error } = await db().rpc("admin_list_mentor_profile_approvals");
  if (error) throw new Error(error.message || "Could not load mentor profiles.");
  return Array.isArray(data) ? data : [];
}

export async function setMentorProfileApproval(mentorUserId, approved) {
  if (!mentorUserId) throw new Error("A mentor is required.");

  const { data, error } = await db().rpc("admin_set_mentor_profile_approval", {
    p_mentor_user_id: mentorUserId,
    p_approved: Boolean(approved)
  });
  if (error) throw new Error(error.message || "Could not update mentor approval.");
  return data;
}
