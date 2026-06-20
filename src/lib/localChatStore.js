/**
 * Local fallback persistence for demo / offline chat.
 */

const PREFIX = "prelude_chat_messages_";
const THREADS_PREFIX = "prelude_chat_threads_";

export function loadLocalChatMessages(threadId) {
  if (!threadId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${threadId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalChatMessages(threadId, messages) {
  if (!threadId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${threadId}`, JSON.stringify(messages));
  } catch {
    /* storage unavailable */
  }
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
