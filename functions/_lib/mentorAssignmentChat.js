/**
 * Mentor↔student chat sync used by admin assignment (Cloudflare Workers).
 */

import { adminRest, first } from "./http.js";

export async function syncAssignedMentorStudentChat(context, { studentId, mentorId }) {
  if (!studentId || !mentorId) {
    throw new Error("studentId and mentorId are required to sync mentor chat.");
  }

  try {
    const rows = await adminRest(context, "rpc/ensure_mentor_student_chat_thread", {
      method: "POST",
      body: JSON.stringify({
        p_mentor_id: mentorId,
        p_student_id: studentId
      })
    });
    return first(rows) || rows;
  } catch (error) {
    return syncAssignedMentorStudentChatFallback(context, { studentId, mentorId });
  }
}

export async function deactivateStudentMentorChats(context, { studentId, exceptMentorId = null }) {
  if (!studentId) return { count: 0 };
  try {
    await adminRest(context, "rpc/deactivate_student_mentor_chats", {
      method: "POST",
      body: JSON.stringify({
        p_student_id: studentId,
        p_except_mentor_id: exceptMentorId
      })
    });
    return { count: 1 };
  } catch {
    return deactivateStudentMentorChatsFallback(context, { studentId, exceptMentorId });
  }
}

async function deactivateStudentMentorChatsFallback(context, { studentId, exceptMentorId = null }) {
  const exceptFilter = exceptMentorId ? `&mentor_id=neq.${encodeURIComponent(exceptMentorId)}` : "";
  try {
    await adminRest(
      context,
      `chat_threads?chat_type=eq.mentor_student&student_id=eq.${encodeURIComponent(studentId)}&deactivated_at=is.null${exceptFilter}`,
      {
        method: "PATCH",
        body: JSON.stringify({ deactivated_at: new Date().toISOString() })
      }
    );
    return { count: 1 };
  } catch {
    return { count: 0 };
  }
}

async function syncAssignedMentorStudentChatFallback(context, { studentId, mentorId }) {
  await deactivateStudentMentorChatsFallback(context, { studentId, exceptMentorId: mentorId });

  const existingRows = await adminRest(
    context,
    `chat_threads?select=*&chat_type=eq.mentor_student&mentor_id=eq.${encodeURIComponent(mentorId)}&student_id=eq.${encodeURIComponent(studentId)}&limit=1`
  );
  const existing = first(existingRows);
  if (existing) {
    if (existing.deactivated_at) {
      const updated = await adminRest(
        context,
        `chat_threads?id=eq.${encodeURIComponent(existing.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ deactivated_at: null })
        }
      );
      return first(updated) || existing;
    }
    return existing;
  }

  const inserted = await adminRest(context, "chat_threads", {
    method: "POST",
    body: JSON.stringify({
      chat_type: "mentor_student",
      mentor_id: mentorId,
      student_id: studentId,
      parent_id: null,
      deactivated_at: null
    })
  });
  return first(inserted);
}
