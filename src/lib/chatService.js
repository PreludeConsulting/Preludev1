/**
 * Prelude 1:1 chat — mentor↔student and mentor↔parent only.
 */

import { getSupabase } from "./supabase.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";
import {
  DEMO_MENTOR,
  DEMO_PARENT,
  DEMO_STUDENT,
  isDemoEmail
} from "../data/demoAccounts.js";
import { normalizeChatAttachment } from "./chatAttachments.js";
import { shouldUseDemoFixtures } from "./devAuthBypass.js";
import {
  appendLocalChatMessage,
  countUnreadChatMessages,
  loadLocalChatMessages,
  loadLocalChatThreads,
  mergeChatMessages,
  removeLocalChatMessage,
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

/** Assignment states that mean "this pair is working together right now". */
export const ACTIVE_MATCH_STATUSES = ["assigned", "accepted", "active"];

export const MESSAGE_STATUS = {
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed"
};

const OPTIMISTIC_ID_PREFIX = "local-";

export function createClientMessageId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `${OPTIMISTIC_ID_PREFIX}${Date.now()}-${random}`;
}

export function isOptimisticMessageId(id) {
  return String(id || "").startsWith(OPTIMISTIC_ID_PREFIX);
}

/**
 * One entry per message: persisted rows win over the optimistic copy they replace,
 * and a repeated realtime/refetch delivery of the same row is ignored.
 */
export function mergeMessagesById(existing = [], incoming = []) {
  const byKey = new Map();

  for (const message of [...existing, ...incoming]) {
    if (!message?.id) continue;
    const persistedKey = isOptimisticMessageId(message.id) ? null : message.id;
    const key = persistedKey || message.clientId || message.id;
    const previous = byKey.get(key);

    if (previous && isOptimisticMessageId(message.id) && !isOptimisticMessageId(previous.id)) {
      continue;
    }
    byKey.set(key, previous ? { ...previous, ...message } : message);
  }

  // A persisted row and its optimistic twin can land under different keys when the
  // server row arrives before the local reconcile; collapse them on clientId.
  const collapsed = new Map();
  for (const message of byKey.values()) {
    const key = !isOptimisticMessageId(message.id) && message.clientId ? message.clientId : message.id;
    const previous = collapsed.get(key);
    if (previous && isOptimisticMessageId(message.id) && !isOptimisticMessageId(previous.id)) continue;
    collapsed.set(key, previous ? { ...previous, ...message } : message);
  }

  return [...collapsed.values()].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
}

const DEMO_IDS = {
  studentEssay: "demo-student-basic",
  studentPlus: "demo-student-plus",
  studentPro: "demo-student-pro",
  student: "demo-student-plus",
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
  const status = row.status || (isOptimisticMessageId(row.id) ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.SENT);
  const attachment = normalizeChatAttachment(row);
  return {
    id: row.id,
    clientId: row.client_id || row.clientId || (isOptimisticMessageId(row.id) ? row.id : null),
    status,
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
    ...attachment,
    isMine: (row.sender_id || row.senderId) === viewerId
  };
}

/** The cache keeps the durable storage key; signed URLs are re-derived per read. */
export function toCacheRow(message, threadId) {
  return {
    id: message.id,
    client_id: message.clientId || null,
    status: message.status || MESSAGE_STATUS.SENT,
    chat_thread_id: message.threadId || threadId,
    chat_type: message.chatType,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    sender_name: message.senderName,
    sender_role: message.senderRole,
    body: message.body,
    read: message.read,
    created_at: message.createdAt,
    edited_at: message.editedAt,
    attachment_path: message.attachmentPath || null,
    // Only inline data survives a reload; a signed URL would be stale by then.
    attachment_url: message.attachmentPath ? null : message.attachmentUrl || null,
    attachment_mime: message.attachmentMime || null,
    attachment_name: message.attachmentName || null,
    attachment_size: message.attachmentSize || null
  };
}

/**
 * Turns a durable storage key into a URL the browser can load. Runs on every read
 * so an expired signature is replaced rather than rendered as a broken image.
 */
async function withResolvedAttachment(row) {
  const { attachmentPath, attachmentUrl } = normalizeChatAttachment(row);
  if (!attachmentPath) return row;

  const path = normalizeChatAttachmentStoragePath(attachmentPath) || attachmentPath;
  const signedUrl = await createPrivateChatAttachmentUrl(path);
  return {
    ...row,
    attachment_path: path,
    attachmentPath: path,
    attachment_url: signedUrl || attachmentUrl || null,
    attachmentUrl: signedUrl || attachmentUrl || null
  };
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

function demoAvatarUrl(account) {
  return account?.avatarUrl || null;
}

function buildDemoParentThreads() {
  const mentorAvatarUrl = demoAvatarUrl(DEMO_MENTOR);
  const raw = [
    {
      id: "demo-thread-mp-jordan-essay",
      chatType: CHAT_TYPE.MENTOR_PARENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.studentEssay,
      parentId: DEMO_IDS.parent,
      mentorName: demoDisplayName(DEMO_MENTOR),
      studentName: "Jordan — Essay Support",
      participantRole: "Mentor",
      avatarUrl: mentorAvatarUrl
    },
    {
      id: "demo-thread-mp-jordan-plus",
      chatType: CHAT_TYPE.MENTOR_PARENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.studentPlus,
      parentId: DEMO_IDS.parent,
      mentorName: demoDisplayName(DEMO_MENTOR),
      studentName: "Jordan — Plus",
      participantRole: "Mentor",
      avatarUrl: mentorAvatarUrl
    },
    {
      id: "demo-thread-mp-jordan-pro",
      chatType: CHAT_TYPE.MENTOR_PARENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.studentPro,
      parentId: DEMO_IDS.parent,
      mentorName: demoDisplayName(DEMO_MENTOR),
      studentName: "Jordan — Pro",
      participantRole: "Mentor",
      avatarUrl: mentorAvatarUrl
    }
  ];

  return applyParentThreadLabels(raw).map(withStorageKey);
}

function buildDemoThreadsForUser(user) {
  const role = (user.role || "student").toLowerCase();
  const threads = [];
  const mentorAvatarUrl = demoAvatarUrl(DEMO_MENTOR);

  if (role === "student") {
    threads.push(withStorageKey({
      id: "demo-thread-ms-jordan",
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.student,
      parentId: null,
      label: demoDisplayName(DEMO_MENTOR),
      sublabel: "Your mentor",
      participantRole: "Mentor",
      avatarUrl: mentorAvatarUrl
    }));
    return threads;
  }

  if (role === "parent") {
    return buildDemoParentThreads();
  }

  if (role === "mentor") {
    threads.push(withStorageKey({
      id: "demo-thread-ms-jordan-essay",
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.studentEssay,
      parentId: null,
      label: "Jordan — Essay Support",
      sublabel: "Essay Support",
      participantRole: "Student"
    }));
    threads.push(withStorageKey({
      id: "demo-thread-ms-jordan-plus",
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.studentPlus,
      parentId: null,
      label: "Jordan — Plus",
      sublabel: "Plus",
      participantRole: "Student"
    }));
    threads.push(withStorageKey({
      id: "demo-thread-ms-jordan-pro",
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId: DEMO_IDS.mentor,
      studentId: DEMO_IDS.studentPro,
      parentId: null,
      label: "Jordan — Pro",
      sublabel: "Pro",
      participantRole: "Student"
    }));
    return threads;
  }

  return threads;
}

/** Prefer fresh demo labels/avatars while keeping any stored thread extras. */
function reconcileDemoThreads(stored, demo) {
  if (!stored?.length) return demo;
  const storedById = new Map(stored.map((thread) => [thread.id, thread]));
  return demo.map((thread) => withStorageKey({
    ...(storedById.get(thread.id) || {}),
    ...thread
  }));
}

async function fetchProfileSummary(userId) {
  if (!userId || !isSupabaseConfigured()) return { name: null, avatarUrl: null };
  const { data } = await db()
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return {
    name: data?.full_name || null,
    avatarUrl: data?.avatar_url || null,
    role: data?.role || null
  };
}

async function fetchProfileName(userId) {
  const profile = await fetchProfileSummary(userId);
  return profile.name;
}

async function resolveMentorForStudent(studentId) {
  const { data } = await db()
    .from("mentor_matches")
    .select("mentor_id, mentor_name")
    .eq("student_id", studentId)
    .in("status", ACTIVE_MATCH_STATUSES)
    .not("mentor_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data;
}

async function resolveStudentThreads(studentId) {
  const match = await resolveMentorForStudent(studentId);
  if (!match?.mentor_id) return [];

  const mentorProfile = await fetchProfileSummary(match.mentor_id);
  const mentorName = match.mentor_name || mentorProfile.name || "Mentor";
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
    participantRole: "Mentor",
    avatarUrl: mentorProfile.avatarUrl || null
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

    const [mentorProfile, studentProfile] = await Promise.all([
      fetchProfileSummary(match.mentor_id),
      fetchProfileSummary(link.student_id)
    ]);

    const thread = await ensureThread({
      chatType: CHAT_TYPE.MENTOR_PARENT,
      mentorId: match.mentor_id,
      studentId: link.student_id,
      parentId
    });

    rawThreads.push({
      ...thread,
      mentorName: mentorProfile.name || match.mentor_name || "Mentor",
      studentName: studentProfile.name || "Student",
      participantRole: "Mentor",
      avatarUrl: mentorProfile.avatarUrl || null
    });
  }

  return applyParentThreadLabels(rawThreads);
}

async function resolveMentorThreads(mentorId) {
  const { data: matches } = await db()
    .from("mentor_matches")
    .select("student_id, status")
    .eq("mentor_id", mentorId)
    .in("status", ACTIVE_MATCH_STATUSES);

  const assignedStudentIds = new Set((matches || []).map((match) => match.student_id).filter(Boolean));
  if (!assignedStudentIds.size) return [];

  const threads = [];
  for (const studentId of assignedStudentIds) {
    const studentProfile = await fetchProfileSummary(studentId);
    const studentThread = await ensureThread({
      chatType: CHAT_TYPE.MENTOR_STUDENT,
      mentorId,
      studentId,
      parentId: null
    });
    threads.push({
      ...studentThread,
      label: studentProfile.name || "Student",
      sublabel: "Assigned student",
      participantRole: "Student",
      avatarUrl: studentProfile.avatarUrl || null
    });
  }

  return threads;
}

async function ensureThread({ chatType, mentorId, studentId, parentId }) {
  const supabase = db();

  if (chatType === CHAT_TYPE.MENTOR_STUDENT) {
    const { data, error } = await supabase.rpc("ensure_mentor_student_chat_thread", {
      p_mentor_id: mentorId,
      p_student_id: studentId
    });
    if (!error && data) {
      return withStorageKey({
        id: data.id,
        chatType: data.chat_type,
        mentorId: data.mentor_id,
        studentId: data.student_id,
        parentId: data.parent_id
      });
    }
  }

  let query = supabase
    .from("chat_threads")
    .select("*")
    .eq("chat_type", chatType)
    .eq("mentor_id", mentorId)
    .is("deactivated_at", null);

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

function titleCaseRole(role) {
  const value = String(role || "").trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function mapRpcThread(row, viewerRole) {
  const participantRole = titleCaseRole(row.participantRole) || (viewerRole === "mentor" ? "Student" : "Mentor");
  const sublabel = participantRole === "Mentor" ? "Your mentor" : "Assigned student";

  return withStorageKey({
    id: row.id,
    chatType: row.chatType,
    mentorId: row.mentorId,
    studentId: row.studentId,
    parentId: row.parentId || null,
    label: row.participantName || participantRole,
    sublabel,
    participantRole,
    participantId: row.participantId || null,
    avatarUrl: row.participantAvatarUrl || null,
    lastMessagePreview: row.lastMessagePreview || "",
    lastMessageAt: row.lastMessageAt || null,
    unreadCount: Number(row.unreadCount) || 0
  });
}

/**
 * Conversations come from the mentor↔student assignment, not from message history:
 * this RPC repairs any missing thread for the caller and returns every active
 * conversation — including ones where nobody has written yet.
 */
async function listThreadsViaRpc(viewerRole) {
  const { data, error } = await db().rpc("list_user_chat_threads");
  if (error) return null;
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return null;
  return rows
    .filter((row) => row?.id)
    .map((row) => mapRpcThread(row, viewerRole));
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
    const merged = reconcileDemoThreads(stored, demo);
    saveLocalChatThreads(user.id, merged);
    return { threads: merged, error: null };
  }

  try {
    const role = (user.role || "student").toLowerCase();
    let threads = null;

    if (role === "student" || role === "mentor") {
      threads = await listThreadsViaRpc(role);
    }

    if (!threads) {
      if (role === "student") threads = await resolveStudentThreads(user.id);
      else if (role === "parent") threads = await resolveParentThreads(user.id);
      else if (role === "mentor") threads = await resolveMentorThreads(user.id);
      else threads = [];
    }

    const normalized = threads.map(withStorageKey);
    if (normalized.length) saveLocalChatThreads(user.id, normalized);
    return { threads: normalized, error: null };
  } catch (err) {
    const cached = loadLocalChatThreads(user.id).map(withStorageKey);
    if (cached.length) return { threads: cached, error: null };
    return { threads: [], error: err.message || "Could not load conversations." };
  }
}

async function resolveAttachmentUrls(messages, viewerId) {
  return Promise.all(
    messages.map(async (message) =>
      message.attachmentPath && !message.attachmentUrl
        ? mapChatMessage(await withResolvedAttachment(message), viewerId)
        : message
    )
  );
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
      return {
        messages: await resolveAttachmentUrls(localRows, user.id),
        error: localRows.length ? null : error.message
      };
    }

    const resolvedRows = await Promise.all((data || []).map(withResolvedAttachment));
    const remoteRows = resolvedRows.map((row) => mapChatMessage(row, user.id));
    const merged = mergeChatMessages(remoteRows, localRows).map((m) => mapChatMessage(m, user.id));
    // Cached rows carry a storage key, not a URL, so sign whatever the merge kept.
    const withUrls = await resolveAttachmentUrls(merged, user.id);
    saveLocalChatMessages(thread, withUrls.map((message) => toCacheRow(message, thread.id)), { silent: true });
    return { messages: withUrls, error: null };
  } catch (err) {
    return {
      messages: await resolveAttachmentUrls(localRows, user.id),
      error: localRows.length ? null : err.message || "Could not load messages."
    };
  }
}

export function buildOptimisticChatMessage(user, threadMeta, { body = "", attachment = null, clientId } = {}) {
  const id = clientId || createClientMessageId();
  const now = new Date().toISOString();
  return mapChatMessage(
    {
      id,
      client_id: id,
      status: MESSAGE_STATUS.SENDING,
      chat_thread_id: threadMeta?.id,
      chat_type: threadMeta?.chatType,
      sender_id: user?.id,
      receiver_id: otherParticipantId(threadMeta, user?.id),
      sender_name: user?.name,
      sender_role: (user?.role || "student").toLowerCase(),
      body: (body || "").trim(),
      read: false,
      created_at: now,
      attachment_url: attachment?.url || null,
      attachment_path: attachment?.path || null,
      attachment_mime: attachment?.mime || null,
      attachment_name: attachment?.name || null,
      attachment_size: attachment?.size || null
    },
    user?.id
  );
}

export async function sendChatMessage(user, threadMeta, { body = "", attachment = null, clientId } = {}) {
  if (!user?.id || !threadMeta?.id) return { message: null, error: "Missing conversation." };
  const trimmed = (body || "").trim();
  if (!trimmed && !attachment?.url && !attachment?.path) {
    return { message: null, error: "Write a message or attach a file." };
  }

  const receiverId = otherParticipantId(threadMeta, user.id);
  const localId = clientId || createClientMessageId();
  const payload = {
    id: localId,
    client_id: localId,
    status: MESSAGE_STATUS.SENDING,
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
    attachment_path: attachment?.path || null,
    attachmentPath: attachment?.path || null,
    attachment_mime: attachment?.mime || null,
    attachmentMime: attachment?.mime || null,
    attachment_name: attachment?.name || null,
    attachmentName: attachment?.name || null,
    attachment_size: attachment?.size || null,
    attachmentSize: attachment?.size || null
  };

  if (shouldUseLocalChat(user)) {
    const stored = { ...payload, status: MESSAGE_STATUS.SENT };
    appendLocalChatMessage(threadMeta, stored, { silent: true });
    return { message: mapChatMessage(stored, user.id), error: null };
  }

  appendLocalChatMessage(threadMeta, payload, { silent: true });

  try {
    const insertRow = {
      chat_thread_id: threadMeta.id,
      chat_type: threadMeta.chatType,
      sender_id: user.id,
      receiver_id: receiverId,
      sender_name: user.name,
      sender_role: (user.role || "student").toLowerCase(),
      body: trimmed || null,
      read: false,
      // The durable storage key lives here; signed URLs are derived on read.
      attachment_url: attachment?.path || attachment?.url || null,
      attachment_mime: attachment?.mime || null,
      attachment_name: attachment?.name || null
    };

    let { data, error } = await db()
      .from("messages")
      .insert(attachment?.size ? { ...insertRow, attachment_size: attachment.size } : insertRow)
      .select("*")
      .single();

    // Deployments that have not run the attachment_size migration yet still send.
    if (error && attachment?.size && /attachment_size/i.test(error.message || "")) {
      ({ data, error } = await db().from("messages").insert(insertRow).select("*").single());
    }

    if (error) {
      removeLocalChatMessage(threadMeta, payload.id, { silent: true });
      return {
        message: null,
        clientId: localId,
        error: error.message || "Message could not be sent."
      };
    }

    const saved = mapChatMessage(
      {
        ...(await withResolvedAttachment(data)),
        client_id: localId,
        status: MESSAGE_STATUS.SENT,
        // The row echoes back only what the schema stores; keep what we uploaded.
        attachment_size: data.attachment_size ?? attachment?.size ?? null,
        attachment_name: data.attachment_name ?? attachment?.name ?? null,
        attachment_mime: data.attachment_mime ?? attachment?.mime ?? null
      },
      user.id
    );
    const localRows = loadLocalChatMessages(threadMeta).filter((m) => m.id !== payload.id);
    saveLocalChatMessages(threadMeta, [...localRows, toCacheRow(saved, threadMeta.id)], { silent: true });
    return { message: saved, clientId: localId, error: null };
  } catch (err) {
    removeLocalChatMessage(threadMeta, payload.id, { silent: true });
    return {
      message: null,
      clientId: localId,
      error: err?.message || "Message could not be sent."
    };
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
  saveLocalChatMessages(threadMeta, nextRows, { silent: true });

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

  const cleanups = [subscribeLocalChatMessages(thread, () => onChange?.({ source: "local" }))];

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (supabase) {
      // Unique topic per subscription instance: a shared topic let a re-mounted
      // effect adopt (and later tear down) the previous mount's channel.
      const channel = supabase
        .channel(`chat-${thread.id}-${Math.random().toString(36).slice(2, 10)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `chat_thread_id=eq.${thread.id}` },
          (payload) => onChange?.({ source: "realtime", event: payload?.eventType, row: payload?.new || null })
        )
        .subscribe();
      cleanups.push(() => {
        supabase.removeChannel(channel);
      });
    }
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    cleanups.forEach((cleanup) => cleanup());
  };
}
