/**
 * Durable chat persistence (localStorage) for demo, offline, and Supabase fallback.
 */

const PREFIX = "prelude_chat_messages_";
const THREADS_PREFIX = "prelude_chat_threads_";

/** Same-tab listeners (storage events only fire across tabs). */
const localMessageListeners = new Map();

function notifyLocalChatChange(threadMeta) {
  const keys = messageKeysForThread(threadMeta);
  const listeners = new Set();
  keys.forEach((key) => {
    localMessageListeners.get(key)?.forEach((listener) => listeners.add(listener));
  });
  listeners.forEach((listener) => listener());
}

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

  notifyLocalChatChange(threadMeta);
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

function isOptimisticMessageId(id) {
  return String(id || "").startsWith("local-");
}

function messagesLikelyMatch(a, b) {
  const aSender = a.sender_id || a.senderId;
  const bSender = b.sender_id || b.senderId;
  if (aSender !== bSender) return false;
  const aBody = (a.body || "").trim();
  const bBody = (b.body || "").trim();
  if (aBody !== bBody) return false;
  const aTime = new Date(a.created_at || a.createdAt || 0).getTime();
  const bTime = new Date(b.created_at || b.createdAt || 0).getTime();
  return Math.abs(aTime - bTime) < 15000;
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

  const merged = [...byId.values()];
  const withoutOptimisticDupes = merged.filter((message) => {
    if (!isOptimisticMessageId(message.id)) return true;
    return !merged.some(
      (other) => other.id !== message.id && !isOptimisticMessageId(other.id) && messagesLikelyMatch(message, other)
    );
  });

  return withoutOptimisticDupes.sort(
    (a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt)
  );
}

export function countUnreadChatMessages(threadMeta, viewerId) {
  if (!threadMeta || !viewerId) return 0;
  return loadLocalChatMessages(threadMeta).filter((message) => {
    const senderId = message.sender_id || message.senderId;
    return senderId !== viewerId && !message.read;
  }).length;
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

  const storageKeys = messageKeysForThread(threadMeta).map((key) => `${PREFIX}${key}`);
  const listenerKeys = messageKeysForThread(threadMeta);

  function handleChange() {
    onChange?.();
  }

  function handleStorage(event) {
    if (!event.key || !storageKeys.includes(event.key)) return;
    handleChange();
  }

  listenerKeys.forEach((key) => {
    if (!localMessageListeners.has(key)) localMessageListeners.set(key, new Set());
    localMessageListeners.get(key).add(handleChange);
  });

  window.addEventListener("storage", handleStorage);
  return () => {
    listenerKeys.forEach((key) => localMessageListeners.get(key)?.delete(handleChange));
    window.removeEventListener("storage", handleStorage);
  };
}
