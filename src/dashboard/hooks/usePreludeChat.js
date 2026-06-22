import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  countUnreadChatMessages,
  editChatMessage,
  listChatThreadsForUser,
  loadChatMessages,
  markChatThreadRead,
  sendChatMessage,
  subscribeChatMessages
} from "../../lib/chatService.js";
import { uploadChatAttachment, validateChatImageFile } from "../../lib/chatStorage.js";
import { loadLocalChatMessages } from "../../lib/localChatStore.js";
import { playIncomingMessageSound } from "../lib/notificationSounds.js";

function shouldPlayIncomingMessageSound(threadId, activeThreadId) {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return true;
  return threadId !== activeThreadId;
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
  const sendingRef = useRef(false);
  const knownMessageIdsRef = useRef(new Map());
  const threadsInitializedRef = useRef(false);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0] || null,
    [threads, activeThreadId]
  );

  const unreadByThread = useMemo(() => {
    if (!user?.id) return {};
    return threads.reduce((acc, thread) => {
      acc[thread.id] = countUnreadChatMessages(thread, user.id);
      return acc;
    }, {});
  }, [threads, threadRevision, user?.id]);

  const unreadTotal = useMemo(
    () => Object.values(unreadByThread).reduce((sum, count) => sum + count, 0),
    [unreadByThread]
  );

  const refreshThreads = useCallback(async () => {
    if (!enabled || !user?.id) return;
    setLoadingThreads(true);
    const { threads: next, error: err } = await listChatThreadsForUser(user);
    setThreads(next);
    if (!activeThreadId && next[0]?.id) setActiveThreadId(next[0].id);
    if (activeThreadId && !next.find((t) => t.id === activeThreadId) && next[0]?.id) {
      setActiveThreadId(next[0].id);
    }
    if (err) setError(err);
    setLoadingThreads(false);
  }, [enabled, user, activeThreadId]);

  const refreshMessages = useCallback(async () => {
    if (!enabled || !user?.id || !activeThread?.id) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    const { messages: next, error: err } = await loadChatMessages(user, activeThread);
    setMessages(next);
    if (err) setError(err);
    setLoadingMessages(false);
  }, [enabled, user, activeThread?.id]);

  const markThreadRead = useCallback(
    async (threadId) => {
      if (!user?.id || !threadId) return;
      const thread = threads.find((item) => item.id === threadId);
      if (!thread) return;
      const { updated } = await markChatThreadRead(user, thread);
      if (updated > 0) {
        setThreadRevision((revision) => revision + 1);
        if (threadId === activeThreadId) {
          await refreshMessages();
        }
      }
    },
    [user, threads, activeThreadId, refreshMessages]
  );

  useEffect(() => {
    if (!user?.id || !threads.length) return;
    threads.forEach((thread) => {
      const rows = loadLocalChatMessages(thread);
      knownMessageIdsRef.current.set(thread.id, new Set(rows.map((row) => row.id)));
    });
    threadsInitializedRef.current = true;
  }, [threads, user?.id]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  useEffect(() => {
    if (!enabled || !threads.length || !user?.id) return undefined;
    const cleanups = threads.map((thread) =>
      subscribeChatMessages(thread, async () => {
        const previousIds = new Set(knownMessageIdsRef.current.get(thread.id) || []);

        if (thread.id === activeThreadId) {
          await refreshMessages();
        } else {
          await loadChatMessages(user, thread);
          setThreadRevision((revision) => revision + 1);
        }

        const rows = loadLocalChatMessages(thread);
        const incoming = rows.filter((row) => {
          const senderId = row.sender_id || row.senderId;
          return !previousIds.has(row.id) && senderId !== user.id;
        });
        knownMessageIdsRef.current.set(thread.id, new Set(rows.map((row) => row.id)));

        if (
          threadsInitializedRef.current &&
          incoming.length > 0 &&
          shouldPlayIncomingMessageSound(thread.id, activeThreadId)
        ) {
          playIncomingMessageSound();
        }
      })
    );
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [enabled, threads, activeThreadId, refreshMessages, user]);

  useEffect(() => {
    if (!enabled || !user?.id) return undefined;

    function handleVisible() {
      if (document.visibilityState === "visible") {
        refreshThreads();
        refreshMessages();
      }
    }

    window.addEventListener("focus", refreshMessages);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("focus", refreshMessages);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [enabled, user?.id, refreshThreads, refreshMessages]);

  const sendMessage = useCallback(
    async ({ body, file }) => {
      if (sendingRef.current) return { ok: false, error: "Sending…" };
      if (!user?.id || !activeThread) return { ok: false, error: "No active conversation." };

      sendingRef.current = true;
      setSending(true);
      setError(null);

      try {
        let attachment = null;
        if (file) {
          const validation = validateChatImageFile(file);
          if (validation) {
            setError(validation);
            return { ok: false, error: validation };
          }
          const uploaded = await uploadChatAttachment(user, activeThread.id, file);
          if (uploaded.error) {
            setError(uploaded.error);
            return { ok: false, error: uploaded.error };
          }
          attachment = uploaded;
        }

        const { error: err } = await sendChatMessage(user, activeThread, { body, attachment });
        if (err) {
          setError(err);
          return { ok: false, error: err };
        }
        return { ok: true };
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [user, activeThread]
  );

  const saveEdit = useCallback(
    async (messageId, body) => {
      if (!user?.id) return { ok: false };
      setError(null);
      const { message, error: err } = await editChatMessage(user, messageId, body);
      if (err) {
        setError(err);
        return { ok: false, error: err };
      }
      if (message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? message : m)));
      }
      setEditingId(null);
      return { ok: true };
    },
    [user]
  );

  return {
    open,
    setOpen,
    threads,
    activeThread,
    activeThreadId,
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
    saveEdit,
    refreshMessages,
    markThreadRead,
    unreadByThread,
    unreadTotal,
    showThreadSwitcher: threads.length > 1,
    threadRevision
  };
}
