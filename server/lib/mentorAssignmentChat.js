/**
 * Mentor↔student chat sync used by admin assignment (Node).
 * Creates one canonical active conversation per assigned pair.
 */

export async function syncAssignedMentorStudentChat(admin, { studentId, mentorId }) {
  if (!admin || !studentId || !mentorId) {
    throw new Error("studentId and mentorId are required to sync mentor chat.");
  }

  const { data, error } = await admin.rpc("ensure_mentor_student_chat_thread", {
    p_mentor_id: mentorId,
    p_student_id: studentId
  });

  if (error) {
    // Fallback for environments that have not applied the RPC migration yet.
    return syncAssignedMentorStudentChatFallback(admin, { studentId, mentorId });
  }

  return data;
}

export async function deactivateStudentMentorChats(admin, { studentId, exceptMentorId = null }) {
  if (!admin || !studentId) return { count: 0 };

  const { error: rpcError } = await admin.rpc("deactivate_student_mentor_chats", {
    p_student_id: studentId,
    p_except_mentor_id: exceptMentorId
  });
  if (!rpcError) return { count: 1 };

  return deactivateStudentMentorChatsFallback(admin, { studentId, exceptMentorId });
}

async function syncAssignedMentorStudentChatFallback(admin, { studentId, mentorId }) {
  await deactivateStudentMentorChatsFallback(admin, { studentId, exceptMentorId: mentorId });

  const { data: existing, error: loadError } = await admin
    .from("chat_threads")
    .select("*")
    .eq("chat_type", "mentor_student")
    .eq("mentor_id", mentorId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (loadError) throw loadError;

  if (existing) {
    if (existing.deactivated_at) {
      const { data, error } = await admin
        .from("chat_threads")
        .update({ deactivated_at: null })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data || existing;
    }
    return existing;
  }

  const { data, error } = await admin
    .from("chat_threads")
    .insert({
      chat_type: "mentor_student",
      mentor_id: mentorId,
      student_id: studentId,
      parent_id: null,
      deactivated_at: null
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function deactivateStudentMentorChatsFallback(admin, { studentId, exceptMentorId = null }) {
  let query = admin
    .from("chat_threads")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("chat_type", "mentor_student")
    .eq("student_id", studentId)
    .is("deactivated_at", null);

  if (exceptMentorId) {
    query = query.neq("mentor_id", exceptMentorId);
  }

  const { error } = await query;
  if (error && !/deactivated_at|column/i.test(error.message || "")) throw error;
  return { count: error ? 0 : 1 };
}
