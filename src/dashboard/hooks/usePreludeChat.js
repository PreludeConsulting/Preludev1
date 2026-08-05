import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  buildOptimisticChatMessage,
  countUnreadChatMessages,
  createClientMessageId,
  editChatMessage,
  listChatThreadsForUser,
  loadChatMessages,
  mapChatMessage,
  markChatThreadRead,
  mergeMessagesById,
  MESSAGE_STATUS,
  sendChatMessage,
  subscribeChatMessages
} from "../../lib/chatService.js";
import { uploadChatAttachment, validateChatImageFile } from "../../lib/chatStorage.js";
import { loadLocalChatMessages } from "../../lib/localChatStore.js";
import { playIncomingMessageSound } from "../lib/notificationSounds.js";

const THREAD_SYNC_INTERVAL_MS = 30000;
const SEND_TIMEOUT_MS = 20000;

function timeoutAfter(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ timedOut: true }), ms);
  });
}

export function usePreludeChat({ enabled = true } = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [threadRevision, setThreadRevision] = useState(0);
  const [lastOutgoingAt, setLastOutgoingAt] = useState(null);

  const sendingRef = useRef(false);
  const userRef = useRef(user);
  const activeThreadIdRef = useRef(activeThreadId);
  const threadsRef = useRef(threads);
  // Persisted ids already rendered (per thread) — the single source of truth for
  // "is this message genuinely new", used for both dedupe and sound.
  const seenMessageIdsRef = useRef(new Map());
  const soundArmedThreadsRef = useRef(new Set());
  const loadedThreadsRef = useRef(new Set());
  const pendingRetryRef = useRef(new Map());
  // Which conversation the rendered `messages` belong to, so a load for a newly
  // selected thread replaces rather than merges into the previous thread's list.
  const renderedThreadRef = useRef(null);

  const userId = user?.id || null;
  userRef.current = user;
  threadsRef.current = threads;

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0] || null,
    [threads, activeThreadId]
  );
  const activeThreadKey = activeThread?.id || null;
  activeThreadIdRef.current = activeThreadKey;

  const unreadByThread = useMemo(() => {
    if (!userId) return {};
    return threads.reduce((acc, thread) => {
      // Locally cached history is the freshest read-state; fall back to the
      // server count so a conversation opened on a new device is still accurate.
      const hasLocalHistory = loadLocalChatMessages(thread).length > 0;
      acc[thread.id] = hasLocalHistory
        ? countUnreadChatMessages(thread, userId)
        : Number(thread.unreadCount) || 0;
      return acc;
    }, {});
  }, [threads, threadRevision, userId]);

  const unreadTotal = useMemo(
    () => Object.values(unreadByThread).reduce((sum, count) => sum + count, 0),
    [unreadByThread]
  );

  const rememberIds = useCallback((threadId, rows) => {
    const seen = seenMessageIdsRef.current.get(threadId) || new Set();
    rows.forEach((row) => {
      const id = row?.id;
      if (id && !String(id).startsWith("local-")) seen.add(id);
    });
    seenMessageIdsRef.current.set(threadId, seen);
  }, []);

  /**
   * @returns {Array} persisted rows from other participants that this hook has
   *   not rendered before. Seeding (first load) returns nothing so history never
   *   replays a notification sound.
   */
  const collectUnseen = useCallback((threadId, rows) => {
    const viewerId = userRef.current?.id;
    const seen = seenMessageIdsRef.current.get(threadId) || new Set();
    const fresh = rows.filter((row) => {
      const id = row?.id;
      if (!id || String(id).startsWith("local-")) return false;
      if (seen.has(id)) return false;
      return (row.senderId || row.sender_id) !== viewerId;
    });
    rememberIds(threadId, rows);
    if (!soundArmedThreadsRef.current.has(threadId)) {
      soundArmedThreadsRef.current.add(threadId);
      return [];
    }
    return fresh;
  }, [rememberIds]);

  const refreshThreads = useCallback(async ({ silent = false } = {}) => {
    const currentUser = userRef.current;
    if (!enabled || !currentUser?.id) return;
    if (!silent) setLoadingThreads(true);
    const { threads: next, error: err } = await listChatThreadsForUser(currentUser);
    setThreads((prev) => {
      // Same conversations, same order → keep the previous array so consumers
      // (and the realtime effect) do not see a new identity on every poll.
      const sameShape =
        prev.length === next.length &&
        prev.every((thread, index) => {
          const candidate = next[index];
          return (
            thread.id === candidate.id &&
            thread.lastMessageAt === candidate.lastMessageAt &&
            thread.lastMessagePreview === candidate.lastMessagePreview &&
            thread.unreadCount === candidate.unreadCount
          );
        });
      return sameShape ? prev : next;
    });

    const selected = activeThreadIdRef.current;
    if ((!selected || !next.find((t) => t.id === selected)) && next[0]?.id) {
      setActiveThreadId(next[0].id);
    }
    if (err) setError(err);
    if (!silent) setLoadingThreads(false);
  }, [enabled]);

  const refreshThreadsRef = useRef(refreshThreads);
  refreshThreadsRef.current = refreshThreads;

  const refreshMessages = useCallback(async ({ silent = false } = {}) => {
    const currentUser = userRef.current;
    const thread = threadsRef.current.find((t) => t.id === activeThreadIdRef.current) || null;
    if (!enabled || !currentUser?.id || !thread?.id) {
      setMessages([]);
      return;
    }

    const firstLoad = !loadedThreadsRef.current.has(thread.id);
    if (firstLoad && !silent) setLoadingMessages(true);

    const { messages: next, error: err } = await loadChatMessages(currentUser, thread);
    if (activeThreadIdRef.current !== thread.id) return;

    // Merge rather than replace: a background refetch must not drop an in-flight
    // optimistic bubble or reset scroll by swapping every element identity.
    const switched = renderedThreadRef.current !== thread.id;
    renderedThreadRef.current = thread.id;
    setMessages((prev) => (switched ? next : mergeMessagesById(prev, next)));
    rememberIds(thread.id, next);
    soundArmedThreadsRef.current.add(thread.id);
    loadedThreadsRef.current.add(thread.id);
    if (err) setError(err);
    if (firstLoad && !silent) setLoadingMessages(false);
  }, [enabled, rememberIds]);

  const refreshMessagesRef = useRef(refreshMessages);
  refreshMessagesRef.current = refreshMessages;

  const markThreadRead = useCallback(
    async (threadId) => {
      const currentUser = userRef.current;
      if (!currentUser?.id || !threadId) return;
      const thread = threadsRef.current.find((item) => item.id === threadId);
      if (!thread) return;
      const { updated } = await markChatThreadRead(currentUser, thread);
      if (updated > 0) {
        setThreadRevision((revision) => revision + 1);
        if (threadId === activeThreadIdRef.current) {
          setMessages((prev) => prev.map((m) => (m.isMine ? m : { ...m, read: true })));
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !userId) return;
    refreshThreads();
  }, [enabled, userId, refreshThreads]);

  useEffect(() => {
    if (!enabled || !userId || !activeThreadKey) {
      renderedThreadRef.current = null;
      setMessages([]);
      return;
    }
    if (renderedThreadRef.current && renderedThreadRef.current !== activeThreadKey) {
      setMessages([]);
    }
    refreshMessagesRef.current?.();
  }, [enabled, userId, activeThreadKey]);

  const threadIdsKey = useMemo(() => threads.map((thread) => thread.id).join("|"), [threads]);

  useEffect(() => {
    if (!enabled || !userId || !threadIdsKey) return undefined;
    const subscribedThreads = threadsRef.current;

    const cleanups = subscribedThreads.map((thread) =>
      subscribeChatMessages(thread, async (event = {}) => {
        const currentUser = userRef.current;
        if (!currentUser?.id) return;
        const isActive = thread.id === activeThreadIdRef.current;
        const row = event.row ? mapChatMessage(event.row, currentUser.id) : null;

        // The insert response already reconciled our own send; a realtime echo of
        // it must not re-enter the list or make a sound.
        const alreadyKnown = row?.id && (seenMessageIdsRef.current.get(thread.id) || new Set()).has(row.id);

        if (isActive && row && !alreadyKnown) {
          setMessages((prev) => mergeMessagesById(prev, [row]));
        }

        let unseen = [];
        if (row) {
          unseen = collectUnseen(thread.id, [row]);
          if (!isActive) setThreadRevision((revision) => revision + 1);
        } else if (isActive) {
          await refreshMessagesRef.current?.({ silent: true });
        } else {
          const { messages: rows } = await loadChatMessages(currentUser, thread);
          unseen = collectUnseen(thread.id, rows);
          setThreadRevision((revision) => revision + 1);
        }

        if (row && !isActive) {
          refreshThreadsRef.current?.({ silent: true });
        }

        // At most one chime per delivery, and only for rows this hook has never
        // rendered before — history loads and repeat events stay silent.
        if (unseen.length > 0) playIncomingMessageSound();
      })
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [enabled, userId, threadIdsKey, collectUnseen]);

  // An admin can assign a mentor while this page is open; pick up the new
  // conversation without requiring a reload or sign-out.
  useEffect(() => {
    if (!enabled || !userId) return undefined;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      refreshThreadsRef.current?.({ silent: true });
    }, THREAD_SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    function syncSilently() {
      refreshThreadsRef.current?.({ silent: true });
      refreshMessagesRef.current?.({ silent: true });
    }

    function handleVisible() {
      if (document.visibilityState === "visible") syncSilently();
    }

    window.addEventListener("focus", syncSilently);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("focus", syncSilently);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [enabled, userId]);

  const deliver = useCallback(
    async (thread, { body, attachment, clientId }) => {
      const currentUser = userRef.current;
      const result = await Promise.race([
        sendChatMessage(currentUser, thread, { body, attachment, clientId }),
        timeoutAfter(SEND_TIMEOUT_MS)
      ]);

      if (result?.timedOut) {
        return { ok: false, error: "Message timed out. Tap retry to send it again." };
      }
      if (result?.error || !result?.message) {
        return { ok: false, error: result?.error || "Message could not be sent." };
      }

      const saved = { ...result.message, clientId, status: MESSAGE_STATUS.SENT };
      rememberIds(thread.id, [saved]);
      setMessages((prev) =>
        activeThreadIdRef.current === thread.id
          ? mergeMessagesById(
              prev.filter((m) => m.id !== clientId && m.clientId !== clientId),
              [saved]
            )
          : prev
      );
      return { ok: true, message: saved };
    },
    [rememberIds]
  );

  const markFailed = useCallback((clientId, message) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === clientId || m.clientId === clientId
          ? { ...m, status: MESSAGE_STATUS.FAILED, error: message }
          : m
      )
    );
  }, []);

  const sendMessage = useCallback(
    async ({ body, file }) => {
      const currentUser = userRef.current;
      const thread = threadsRef.current.find((t) => t.id === activeThreadIdRef.current) || null;
      if (sendingRef.current) return { ok: false, error: "Sending…" };
      if (!currentUser?.id || !thread) return { ok: false, error: "No active conversation." };

      const trimmed = (body || "").trim();
      if (!trimmed && !file) return { ok: false, error: "Write a message or attach a photo." };

      sendingRef.current = true;
      setSending(true);
      setError(null);

      const clientId = createClientMessageId();
      const optimistic = buildOptimisticChatMessage(currentUser, thread, { body: trimmed, clientId });
      setMessages((prev) => mergeMessagesById(prev, [optimistic]));
      setLastOutgoingAt(Date.now());

      try {
        let attachment = null;
        if (file) {
          const validation = validateChatImageFile(file);
          if (validation) {
            setError(validation);
            setMessages((prev) => prev.filter((m) => m.id !== clientId));
            return { ok: false, error: validation };
          }
          const uploaded = await uploadChatAttachment(currentUser, thread.id, file);
          if (uploaded.error) {
            setError(uploaded.error);
            markFailed(clientId, uploaded.error);
            return { ok: false, error: uploaded.error };
          }
          attachment = uploaded;
        }

        pendingRetryRef.current.set(clientId, { thread, body: trimmed, attachment });
        const result = await deliver(thread, { body: trimmed, attachment, clientId });
        if (!result.ok) {
          setError(result.error);
          markFailed(clientId, result.error);
          return { ok: false, error: result.error };
        }
        pendingRetryRef.current.delete(clientId);
        return { ok: true, message: result.message };
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [deliver, markFailed]
  );

  const retryMessage = useCallback(
    async (clientId) => {
      const pending = pendingRetryRef.current.get(clientId);
      if (!pending) return { ok: false, error: "Nothing to retry." };

      setError(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientId || m.clientId === clientId
            ? { ...m, status: MESSAGE_STATUS.SENDING, error: null }
            : m
        )
      );

      const result = await deliver(pending.thread, {
        body: pending.body,
        attachment: pending.attachment,
        clientId
      });
      if (!result.ok) {
        setError(result.error);
        markFailed(clientId, result.error);
        return { ok: false, error: result.error };
      }
      pendingRetryRef.current.delete(clientId);
      return { ok: true, message: result.message };
    },
    [deliver, markFailed]
  );

  const saveEdit = useCallback(
    async (messageId, body) => {
      const currentUser = userRef.current;
      if (!currentUser?.id) return { ok: false };
      setError(null);
      const { message, error: err } = await editChatMessage(currentUser, messageId, body);
      if (err) {
        setError(err);
        return { ok: false, error: err };
      }
      if (message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...message } : m)));
      }
      setEditingId(null);
      return { ok: true };
    },
    []
  );

  return {
    open,
    setOpen,
    threads,
    activeThread,
    activeThreadId: activeThreadKey,
    setActiveThreadId,
    messages,
    loadingThreads,
    loadingMessages,
    sending,
    error,
    setError,
    editingId,
    setEditingId,
    sendMessage,
    retryMessage,
    saveEdit,
    refreshMessages,
    markThreadRead,
    unreadByThread,
    unreadTotal,
    lastOutgoingAt,
    showThreadSwitcher: threads.length > 1,
    threadRevision
  };
}
