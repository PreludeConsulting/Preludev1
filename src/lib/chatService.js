/**
 * Prelude 1:1 chat — mentor↔student and mentor↔parent only.
 */

import { getSupabase } from "./supabase.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";
import {
  DEMO_MENTOR,
  DEMO_PARENT,
  DEMO_STUDENT,
  DEMO_STUDENT_2,
  isDemoEmail
} from "../data/demoAccounts.js";
import { shouldUseDemoFixtures } from "./devAuthBypass.js";
import {
  appendLocalChatMessage,
  countUnreadChatMessages,
  loadLocalChatMessages,
  loadLocalChatThreads,
  mergeChatMessages,
  saveLocalChatMessages,
  saveLocalChatThreads,
  subscribeLocalChatMessages,
  threadStorageKey,
  updateLocalChatMessage
} from "./localChatStore.js";
import { applyParentThreadLabels } from "./parentChatLabels.js";
import { createPrivateChatAttachmentUrl, normalizeChatAttachmentStoragePath } from "./chatStorage.js";

export { applyParentThreadLabels } from "./parentChatLabels.js";

export const CHAT_TYPE = {
  MENTOR_STUDENT: "mentor_student",
  MENTOR_PARENT: "mentor_parent"
};

const DEMO_IDS = {
  student: "demo-student",
  student2: "demo-student2",
  mentor: "demo-mentor",
  parent: "demo-parent"
};

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function shouldUseLocalChat(user) {
  if (!user) return true;
  if (user.authProvider === "demo" || user.authProvider === "dev") return true;
  if (shouldUseDemoFixtures(user)) return true;
  if (user.email && isDemoEmail(user.email)) return true;
  return !isSupabaseConfigured();
}

export function mapChatMessage(row, viewerId) {
  return {
    id: row.id,
    threadId: row.chat_thread_id || row.threadId,
    chatType: row.chat_type || row.chatType,
    senderId: row.sender_id || row.senderId,
    receiverId: row.receiver_id || row.receiverId,
    senderName: row.sender_name || row.senderName,
    senderRole: row.sender_role || row.senderRole,
    body: row.body || "",
    read: Boolean(row.read),
    createdAt: row.created_at || row.createdAt,
    editedAt: row.edited_at || row.editedAt || null,
    attachmentUrl: row.attachment_url || row.attachmentUrl || null,
    attachmentMime: row.attachment_mime || row.attachmentMime || null,
    attachmentName: row.attachment_name || row.attachmentName || null,
    isMine: (row.sender_id || row.senderId) === viewerId
  };
}

async function withResolvedAttachment(row) {
  const stored = row?.attachment_url || row?.attachmentUrl;
  const path = normalizeChatAttachmentStoragePath(stored);
  if (!path) return row;
  const signedUrl = await createPrivateChatAttachmentUrl(path);
  return signedUrl ? { ...row, attachment_url: signedUrl, attachmentUrl: signedUrl } : row;
}

function withStorageKey(thread) {
  return {
    ...thread,
    storageKey: thread.storageKey || threadStorageKey(thread)
  };
}

function demoDisplayName(account) {
  return `${account.firstName} ${account.lastName}`;
}

function buildDemoParentThreads() {
  const raw = [
    {
      id: "demo-thread-mp-jordan",
      chatType: CHAT_TYPE.MENTOR_PARENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.student,
      parentId: DEMO_IDS.parent,
      mentorName: demoDisplayName(DEMO_MENTOR),
      studentName: demoDisplayName(DEMO_STUDENT),
      participantRole: "Mentor"
    },
    {
      id: "demo-thread-mp-alex",
      chatType: CHAT_TYPE.MENTOR_PARENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.student2,
      parentId: DEMO_IDS.parent,
      mentorName: demoDisplayName(DEMO_MENTOR),
      studentName: demoDisplayName(DEMO_STUDENT_2),
      participantRole: "Mentor"
    }
  ];

  return applyParentThreadLabels(raw).map(withStorageKey);
}

function buildDemoThreadsForUser(user) {
  const role = (user.role || "student").toLowerCase();
  const threads = [];

  if (role === "student") {
    threads.push(withStorageKey({
      id: "demo-thread-ms-jordan",
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.student,
      parentId: null,
      label: demoDisplayName(DEMO_MENTOR),
      sublabel: "Your mentor",
      participantRole: "Mentor"
    }));
    return threads;
  }

  if (role === "parent") {
    return buildDemoParentThreads();
  }

  if (role === "mentor") {
    threads.push(withStorageKey({
      id: "demo-thread-ms-jordan",
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.student,
      parentId: null,
      label: demoDisplayName(DEMO_STUDENT),
      sublabel: "Student",
      participantRole: "Student"
    }));
    threads.push(withStorageKey({
      id: "demo-thread-ms-alex",
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.student2,
      parentId: null,
      label: demoDisplayName(DEMO_STUDENT_2),
      sublabel: "Student",
      participantRole: "Student"
    }));
    return threads;
  }

  return threads;
}

async function fetchProfileName(userId) {
  if (!userId || !isSupabaseConfigured()) return null;
  const { data } = await db().from("profiles").select("full_name, role").eq("id", userId).maybeSingle();
  return data?.full_name || null;
}

async function resolveMentorForStudent(studentId) {
  const { data } = await db()
    .from("mentor_matches")
    .select("mentor_id, mentor_name")
    .eq("student_id", studentId)
    .eq("status", "assigned")
    .limit(1)
    .maybeSingle();
  return data;
}

async function resolveStudentThreads(studentId) {
  const match = await resolveMentorForStudent(studentId);
  if (!match?.mentor_id) return [];

  const mentorName = match.mentor_name || (await fetchProfileName(match.mentor_id)) || "Mentor";
  const thread = await ensureThread({
    chatType: CHAT_TYPE.MENTOR_STUDENT,
    mentorId: match.mentor_id,
    studentId,
    parentId: null
  });

  return [{
    ...thread,
    label: mentorName,
    sublabel: "Your mentor",
    participantRole: "Mentor"
  }];
}

async function resolveParentThreads(parentId) {
  const { data: links } = await db()
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", parentId);
  if (!links?.length) return [];

  const rawThreads = [];
  for (const link of links) {
    const match = await resolveMentorForStudent(link.student_id);
    if (!match?.mentor_id) continue;

    const [mentorName, studentName] = await Promise.all([
      fetchProfileName(match.mentor_id),
      fetchProfileName(link.student_id)
    ]);

    const thread = await ensureThread({
      chatType: CHAT_TYPE.MENTOR_PARENT,
      mentorId: match.mentor_id,
      studentId: link.student_id,
      parentId
    });

    rawThreads.push({
      ...thread,
      mentorName: mentorName || match.mentor_name || "Mentor",
      studentName: studentName || "Student",
      participantRole: "Mentor"
    });
  }

  return applyParentThreadLabels(rawThreads);
}

async function resolveMentorThreads(mentorId) {
  const { data: matches } = await db()
    .from("mentor_matches")
    .select("student_id, status")
    .eq("mentor_id", mentorId)
    .in("status", ["assigned", "accepted", "active"]);

  const assignedStudentIds = new Set((matches || []).map((match) => match.student_id).filter(Boolean));
  const discoveredStudentIds = new Set();

  const { data: mentorStudentThreads } = await db()
    .from("chat_threads")
    .select("id, mentor_id, student_id, parent_id, chat_type")
    .eq("mentor_id", mentorId)
    .eq("chat_type", CHAT_TYPE.MENTOR_STUDENT);

  for (const row of mentorStudentThreads || []) {
    if (row.student_id) discoveredStudentIds.add(row.student_id);
  }

  const studentIds = Array.from(new Set([...assignedStudentIds, ...discoveredStudentIds]));
  if (!studentIds.length) return [];

  const threads = [];
  for (const studentId of studentIds) {
    const studentName = (await fetchProfileName(studentId)) || "Student";
    const studentThread = await ensureThread({
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId,
      studentId,
      parentId: null
    });
    threads.push({
      ...studentThread,
      label: studentName,
      sublabel: assignedStudentIds.has(studentId) ? "Assigned student" : "Student",
      participantRole: "Student"
    });
  }

  return threads;
}

async function ensureThread({ chatType, mentorId, studentId, parentId }) {
  const supabase = db();
  let query = supabase.from("chat_threads").select("*").eq("chat_type", chatType).eq("mentor_id", mentorId);

  if (chatType === CHAT_TYPE.MENTOR_STUDENT) {
    query = query.eq("student_id", studentId);
  } else {
    query = query.eq("parent_id", parentId).eq("student_id", studentId);
  }

  const { data: existing } = await query.maybeSingle();
  if (existing) {
    return withStorageKey({
      id: existing.id,
      chatType: existing.chat_type,
      mentorId: existing.mentor_id,
      studentId: existing.student_id,
      parentId: existing.parent_id
    });
  }

  const insertPayload = {
    chat_type: chatType,
    mentor_id: mentorId,
    student_id: studentId,
    parent_id: parentId
  };

  const { data, error } = await supabase.from("chat_threads").insert(insertPayload).select("*").single();
  if (error) throw new Error(error.message);

  return withStorageKey({
    id: data.id,
    chatType: data.chat_type,
    mentorId: data.mentor_id,
    studentId: data.student_id,
    parentId: data.parent_id
  });
}

function otherParticipantId(thread, viewerId) {
  if (thread.mentorId === viewerId) {
    return thread.chatType === CHAT_TYPE.MENTOR_PARENT ? thread.parentId : thread.studentId;
  }
  return thread.mentorId;
}

export async function listChatThreadsForUser(user) {
  if (!user?.id) return { threads: [], error: "Sign in to use chat." };

  if (shouldUseLocalChat(user)) {
    const role = (user.role || "student").toLowerCase();
    const demo = buildDemoThreadsForUser(user);
    if (role === "parent") {
      saveLocalChatThreads(user.id, demo);
      return { threads: demo, error: null };
    }
    const stored = loadLocalChatThreads(user.id);
    const merged = stored.length ? stored.map(withStorageKey) : demo;
    if (!stored.length) saveLocalChatThreads(user.id, demo);
    return { threads: merged, error: null };
  }

  try {
    const role = (user.role || "student").toLowerCase();
    let threads = [];
    if (role === "student") threads = await resolveStudentThreads(user.id);
    else if (role === "parent") threads = await resolveParentThreads(user.id);
    else if (role === "mentor") threads = await resolveMentorThreads(user.id);
    const normalized = threads.map(withStorageKey);
    if (normalized.length) saveLocalChatThreads(user.id, normalized);
    return { threads: normalized, error: null };
  } catch (err) {
    const cached = loadLocalChatThreads(user.id).map(withStorageKey);
    if (cached.length) return { threads: cached, error: null };
    return { threads: [], error: err.message || "Could not load conversations." };
  }
}

export async function loadChatMessages(user, threadMeta) {
  const thread = typeof threadMeta === "string" ? { id: threadMeta } : threadMeta;
  if (!user?.id || !thread?.id) return { messages: [], error: null };

  const localRows = loadLocalChatMessages(thread).map((m) => mapChatMessage(m, user.id));

  if (shouldUseLocalChat(user)) {
    return { messages: localRows, error: null };
  }

  try {
    const { data, error } = await db()
      .from("messages")
      .select("*")
      .eq("chat_thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (error) {
      return { messages: localRows, error: localRows.length ? null : error.message };
    }

    const resolvedRows = await Promise.all((data || []).map(withResolvedAttachment));
    const remoteRows = resolvedRows.map((row) => mapChatMessage(row, user.id));
    const merged = mergeChatMessages(remoteRows, localRows).map((m) => mapChatMessage(m, user.id));
    saveLocalChatMessages(thread, merged.map((message) => ({
      id: message.id,
      chat_thread_id: thread.id,
      chat_type: message.chatType,
      sender_id: message.senderId,
      receiver_id: message.receiverId,
      sender_name: message.senderName,
      sender_role: message.senderRole,
      body: message.body,
      read: message.read,
      created_at: message.createdAt,
      edited_at: message.editedAt,
      attachment_url: message.attachmentUrl,
      attachment_mime: message.attachmentMime,
      attachment_name: message.attachmentName
    })));
    return { messages: merged, error: null };
  } catch (err) {
    return {
      messages: localRows,
      error: localRows.length ? null : err.message || "Could not load messages."
    };
  }
}

export async function sendChatMessage(user, threadMeta, { body = "", attachment = null }) {
  if (!user?.id || !threadMeta?.id) return { message: null, error: "Missing conversation." };
  const trimmed = (body || "").trim();
  if (!trimmed && !attachment?.url) return { message: null, error: "Write a message or attach a photo." };

  const receiverId = otherParticipantId(threadMeta, user.id);
  const payload = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chat_thread_id: threadMeta.id,
    threadId: threadMeta.id,
    chat_type: threadMeta.chatType,
    chatType: threadMeta.chatType,
    sender_id: user.id,
    senderId: user.id,
    receiver_id: receiverId,
    receiverId,
    sender_name: user.name,
    senderName: user.name,
    sender_role: (user.role || "student").toLowerCase(),
    senderRole: (user.role || "student").toLowerCase(),
    body: trimmed,
    read: false,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    edited_at: null,
    editedAt: null,
    attachment_url: attachment?.url || null,
    attachmentUrl: attachment?.url || null,
    attachment_mime: attachment?.mime || null,
    attachmentMime: attachment?.mime || null,
    attachment_name: attachment?.name || null,
    attachmentName: attachment?.name || null
  };

  if (shouldUseLocalChat(user)) {
    appendLocalChatMessage(threadMeta, payload);
    return { message: mapChatMessage(payload, user.id), error: null };
  }

  appendLocalChatMessage(threadMeta, payload);

  try {
    const { data, error } = await db()
      .from("messages")
      .insert({
        chat_thread_id: threadMeta.id,
        chat_type: threadMeta.chatType,
        sender_id: user.id,
        receiver_id: receiverId,
        sender_name: user.name,
        sender_role: (user.role || "student").toLowerCase(),
        body: trimmed || null,
        read: false,
        attachment_url: attachment?.path || attachment?.url || null,
        attachment_mime: attachment?.mime || null,
        attachment_name: attachment?.name || null
      })
      .select("*")
      .single();

    if (error) {
      return { message: mapChatMessage(payload, user.id), error: null };
    }

    const saved = mapChatMessage(await withResolvedAttachment(data), user.id);
    const localRows = loadLocalChatMessages(threadMeta).filter((m) => m.id !== payload.id);
    saveLocalChatMessages(threadMeta, [...localRows, {
      id: data.id,
      chat_thread_id: threadMeta.id,
      chat_type: threadMeta.chatType,
      sender_id: data.sender_id,
      receiver_id: data.receiver_id,
      sender_name: data.sender_name,
      sender_role: data.sender_role,
      body: data.body,
      read: data.read,
      created_at: data.created_at,
      edited_at: data.edited_at,
      attachment_url: data.attachment_url,
      attachment_mime: data.attachment_mime,
      attachment_name: data.attachment_name
    }]);
    return { message: saved, error: null };
  } catch {
    return { message: mapChatMessage(payload, user.id), error: null };
  }
}

const EDIT_WINDOW_MS = 2 * 60 * 1000;
const EDIT_WINDOW_ERROR = "You can only edit a message within 2 minutes of sending it.";

function isWithinEditWindow(row) {
  const created = row?.created_at || row?.createdAt;
  if (!created) return true;
  return Date.now() - new Date(created).getTime() <= EDIT_WINDOW_MS;
}

export async function editChatMessage(user, messageId, body) {
  if (!user?.id || !messageId) return { message: null, error: "Missing message." };
  const trimmed = (body || "").trim();
  if (!trimmed) return { message: null, error: "Message cannot be empty." };

  if (shouldUseLocalChat(user)) {
    const threadIds = (loadLocalChatThreads(user.id).length
      ? loadLocalChatThreads(user.id)
      : buildDemoThreadsForUser(user)
    ).map((t) => withStorageKey(t));

    for (const thread of threadIds) {
      const rows = loadLocalChatMessages(thread);
      const idx = rows.findIndex((m) => m.id === messageId && (m.sender_id || m.senderId) === user.id);
      if (idx === -1) continue;
      if (!isWithinEditWindow(rows[idx])) return { message: null, error: EDIT_WINDOW_ERROR };
      const updated = {
        ...rows[idx],
        body: trimmed,
        edited_at: new Date().toISOString(),
        editedAt: new Date().toISOString()
      };
      updateLocalChatMessage(thread, messageId, updated);
      return { message: mapChatMessage(updated, user.id), error: null };
    }
    return { message: null, error: "Message not found." };
  }

  const cachedThreads = loadLocalChatThreads(user.id).map(withStorageKey);
  const cachedOwnMessage = cachedThreads
    .flatMap((thread) => loadLocalChatMessages(thread))
    .find((m) => m.id === messageId && (m.sender_id || m.senderId) === user.id);
  if (cachedOwnMessage && !isWithinEditWindow(cachedOwnMessage)) {
    return { message: null, error: EDIT_WINDOW_ERROR };
  }
  for (const thread of cachedThreads) {
    const rows = loadLocalChatMessages(thread);
    if (!rows.some((m) => m.id === messageId)) continue;
    updateLocalChatMessage(thread, messageId, (row) => ({
      ...row,
      body: trimmed,
      edited_at: new Date().toISOString(),
      editedAt: new Date().toISOString()
    }));
  }

  try {
    const { data, error } = await db()
      .from("messages")
      .update({ body: trimmed, edited_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("sender_id", user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      const localOnly = cachedThreads
        .flatMap((thread) => loadLocalChatMessages(thread))
        .find((m) => m.id === messageId && (m.sender_id || m.senderId) === user.id);
      if (localOnly) return { message: mapChatMessage(localOnly, user.id), error: null };
      return { message: null, error: error.message };
    }
    if (!data) {
      const localOnly = cachedThreads
        .flatMap((thread) => loadLocalChatMessages(thread))
        .find((m) => m.id === messageId && (m.sender_id || m.senderId) === user.id);
      if (localOnly) return { message: mapChatMessage({ ...localOnly, body: trimmed }, user.id), error: null };
      return { message: null, error: "Message not found or not editable." };
    }
    return { message: mapChatMessage(await withResolvedAttachment(data), user.id), error: null };
  } catch (err) {
    const localOnly = cachedThreads
      .flatMap((thread) => loadLocalChatMessages(thread))
      .find((m) => m.id === messageId && (m.sender_id || m.senderId) === user.id);
    if (localOnly) return { message: mapChatMessage({ ...localOnly, body: trimmed }, user.id), error: null };
    return { message: null, error: err.message || "Could not edit message." };
  }
}

export { countUnreadChatMessages } from "./localChatStore.js";

export async function markChatThreadRead(user, threadMeta) {
  if (!user?.id || !threadMeta?.id) return { updated: 0, error: null };

  const rows = loadLocalChatMessages(threadMeta);
  const unread = rows.filter((message) => {
    const senderId = message.sender_id || message.senderId;
    return senderId !== user.id && !message.read;
  });
  if (!unread.length) return { updated: 0, error: null };

  const unreadIds = new Set(unread.map((message) => message.id));
  const nextRows = rows.map((message) => (unreadIds.has(message.id) ? { ...message, read: true } : message));
  saveLocalChatMessages(threadMeta, nextRows);

  if (shouldUseLocalChat(user)) {
    return { updated: unread.length, error: null };
  }

  try {
    const { error } = await db()
      .from("messages")
      .update({ read: true })
      .eq("chat_thread_id", threadMeta.id)
      .eq("receiver_id", user.id)
      .eq("read", false);
    return { updated: unread.length, error: error?.message || null };
  } catch (err) {
    return { updated: unread.length, error: err.message || "Could not mark messages read." };
  }
}

export function subscribeChatMessages(threadMeta, onChange) {
  const thread = typeof threadMeta === "string" ? { id: threadMeta } : threadMeta;
  if (!thread?.id) return () => {};

  const cleanups = [subscribeLocalChatMessages(thread, onChange)];

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (supabase) {
      const channel = supabase
        .channel(`chat-${thread.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `chat_thread_id=eq.${thread.id}` },
          () => onChange?.()
        )
        .subscribe();
      cleanups.push(() => {
        supabase.removeChannel(channel);
      });
    }
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
