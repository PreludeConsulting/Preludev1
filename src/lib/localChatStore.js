/**
 * Durable chat persistence (localStorage) for demo, offline, and Supabase fallback.
 */

const PREFIX = "prelude_chat_messages_";
const THREADS_PREFIX = "prelude_chat_threads_";

export function threadStorageKey(threadMeta) {
  if (!threadMeta) return "";
  if (threadMeta.storageKey) return threadMeta.storageKey;
  if (!threadMeta.chatType) return threadMeta.id || "";

  const mentorId = threadMeta.mentorId || threadMeta.mentor_id;
  const studentId = threadMeta.studentId || threadMeta.student_id;
  const parentId = threadMeta.parentId || threadMeta.parent_id;

  if (threadMeta.chatType === "mentor_parent") {
    return `mp:${mentorId}:${parentId}:${studentId}`;
  }
  return `ms:${mentorId}:${studentId}`;
}

function messageKeysForThread(threadMeta) {
  const keys = new Set();
  if (threadMeta?.id) keys.add(threadMeta.id);
  const storageKey = threadStorageKey(threadMeta);
  if (storageKey) keys.add(storageKey);
  return [...keys];
}

export function loadLocalChatMessages(threadMeta) {
  if (!threadMeta || typeof window === "undefined") return [];

  const keys = messageKeysForThread(threadMeta);
  let best = [];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(`${PREFIX}${key}`);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > best.length) {
        best = parsed;
      }
    } catch {
      /* ignore corrupt entry */
    }
  }

  return best;
}

export function saveLocalChatMessages(threadMeta, messages) {
  if (!threadMeta || typeof window === "undefined") return;
  const payload = JSON.stringify(messages);
  const keys = messageKeysForThread(threadMeta);

  for (const key of keys) {
    try {
      window.localStorage.setItem(`${PREFIX}${key}`, payload);
    } catch {
      /* quota or private mode */
    }
  }
}

export function appendLocalChatMessage(threadMeta, message) {
  const existing = loadLocalChatMessages(threadMeta);
  const next = [...existing.filter((m) => m.id !== message.id), message].sort(
    (a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt)
  );
  saveLocalChatMessages(threadMeta, next);
  return next;
}

export function updateLocalChatMessage(threadMeta, messageId, updater) {
  const existing = loadLocalChatMessages(threadMeta);
  const idx = existing.findIndex((m) => m.id === messageId);
  if (idx === -1) return existing;
  const updated = typeof updater === "function" ? updater(existing[idx]) : { ...existing[idx], ...updater };
  const next = [...existing];
  next[idx] = updated;
  saveLocalChatMessages(threadMeta, next);
  return next;
}

export function mergeChatMessages(...lists) {
  const byId = new Map();

  lists.flat().forEach((message) => {
    if (!message?.id) return;
    const existing = byId.get(message.id);
    if (!existing) {
      byId.set(message.id, message);
      return;
    }
    const existingTime = new Date(existing.edited_at || existing.editedAt || existing.created_at || existing.createdAt || 0);
    const nextTime = new Date(message.edited_at || message.editedAt || message.created_at || message.createdAt || 0);
    byId.set(message.id, nextTime >= existingTime ? message : existing);
  });

  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt)
  );
}

export function loadLocalChatThreads(userId) {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${THREADS_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalChatThreads(userId, threads) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${THREADS_PREFIX}${userId}`, JSON.stringify(threads));
  } catch {
    /* ignore */
  }
}

export function subscribeLocalChatMessages(threadMeta, onChange) {
  if (!threadMeta || typeof window === "undefined") return () => {};

  const keys = messageKeysForThread(threadMeta).map((key) => `${PREFIX}${key}`);

  function handleStorage(event) {
    if (!event.key || !keys.includes(event.key)) return;
    onChange?.();
  }

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
