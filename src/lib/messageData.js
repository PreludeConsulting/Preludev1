/**
 * Supabase messaging helpers.
 */

import { getSupabase } from "./supabase.js";

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export function mapMessage(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    body: row.body,
    read: row.read,
    createdAt: row.created_at
  };
}

export async function getMyMessages(userId) {
  if (!userId) return { messages: [], error: "You must be signed in." };

  const { data, error } = await db()
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId},user_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  return { messages: (data || []).map(mapMessage), error: error?.message || null };
}

export async function sendMessage(userId, { body, senderName, senderRole = "student", threadId = "mentor", receiverId = null }) {
  if (!userId) return { message: null, error: "You must be signed in." };
  if (!body?.trim()) return { message: null, error: "Message body is required." };

  const payload = {
    sender_id: userId,
    receiver_id: receiverId,
    user_id: userId,
    thread_id: threadId,
    sender_name: senderName,
    sender_role: senderRole,
    body: body.trim(),
    read: senderRole === "student"
  };

  const { data, error } = await db().from("messages").insert(payload).select().single();
  return { message: data ? mapMessage(data) : null, error: error?.message || null };
}

export async function markMessagesRead(userId, messageIds) {
  if (!userId) return { error: "You must be signed in." };
  const query = db().from("messages").update({ read: true }).or(`receiver_id.eq.${userId},user_id.eq.${userId}`);
  if (messageIds?.length) query.in("id", messageIds);
  const { error } = await query;
  return { error: error?.message || null };
}
