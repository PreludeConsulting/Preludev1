import { getSupabase } from "./supabase.js";
import { getInitials } from "./avatar.js";
import { computeNextOpening } from "./mentorNextOpening.js";

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

/**
 * Map a LIVE mentor_matching_profiles row (returned by list_my_network_mentors)
 * into the student Mentor Network card view-model. Nothing here is persisted —
 * every field reflects the mentor's current profile on each fetch.
 */
export function mapNetworkMentor(row) {
  if (!row) return null;
  const name = row.displayName || "Prelude mentor";
  const targetMajors = asArray(row.targetMajors);
  const targetSchools = asArray(row.targetSchools);
  const specialties = asArray(row.specialties);
  const targets = targetMajors.length ? targetMajors : targetSchools;
  return {
    id: row.mentorUserId,
    name,
    avatarUrl: row.avatarUrl || null,
    photo: row.avatarUrl || null,
    initials: getInitials(name, "M"),
    school: row.college || "",
    university: row.college || "",
    major: row.major || "",
    bio: row.bio || "",
    specialties,
    tags: specialties.slice(0, 3),
    targets,
    targetMajors,
    targetSchools,
    availability: row.availability || "",
    availabilitySchedule: row.availabilitySchedule || null,
    nextOpening: computeNextOpening(row.availabilitySchedule)
  };
}

/** Student: the mentors an admin added to MY Network (live data, Plus/Pro gated). */
export async function listMyMentorNetwork() {
  const { data, error } = await db().rpc("list_my_network_mentors");
  if (error) {
    return { eligible: false, mentors: [], error: error.message };
  }
  const payload = data || {};
  return {
    eligible: Boolean(payload.eligible),
    mentors: asArray(payload.mentors).map(mapNetworkMentor).filter(Boolean),
    error: null
  };
}

/**
 * Student: hand a Network mentor into the EXISTING messaging system. Returns the
 * conversation thread id (reusing an assignment conversation when present).
 */
export async function ensureNetworkChatThread(mentorId) {
  if (!mentorId) return { threadId: null, error: "A mentor is required." };
  const { data, error } = await db().rpc("ensure_network_chat_thread", {
    p_mentor_id: mentorId
  });
  if (error) return { threadId: null, error: error.message };
  return { threadId: data?.id || null, error: null };
}

/** Admin: read a student's Network membership + Plus/Pro eligibility. */
export async function adminGetStudentNetwork(studentId) {
  if (!studentId) return { eligible: false, mentorIds: [], error: "A student is required." };
  const { data, error } = await db().rpc("admin_get_student_network", {
    p_student: studentId
  });
  if (error) return { eligible: false, mentorIds: [], error: error.message };
  return {
    eligible: Boolean(data?.eligible),
    mentorIds: asArray(data?.mentorIds),
    error: null
  };
}

/** Admin: add a mentor to a student's Network. Returns the updated membership. */
export async function adminAddStudentNetworkMentor(studentId, mentorId) {
  const { data, error } = await db().rpc("admin_add_student_network_mentor", {
    p_student: studentId,
    p_mentor: mentorId
  });
  if (error) return { eligible: false, mentorIds: [], error: error.message };
  return {
    eligible: Boolean(data?.eligible),
    mentorIds: asArray(data?.mentorIds),
    error: null
  };
}

/** Admin: remove a mentor from a student's Network. Returns the updated membership. */
export async function adminRemoveStudentNetworkMentor(studentId, mentorId) {
  const { data, error } = await db().rpc("admin_remove_student_network_mentor", {
    p_student: studentId,
    p_mentor: mentorId
  });
  if (error) return { eligible: false, mentorIds: [], error: error.message };
  return {
    eligible: Boolean(data?.eligible),
    mentorIds: asArray(data?.mentorIds),
    error: null
  };
}
