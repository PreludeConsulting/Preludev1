import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  editChatMessage,
  listChatThreadsForUser,
  loadChatMessages,
  sendChatMessage,
  subscribeChatMessages
} from "../../lib/chatService.js";
import { uploadChatAttachment, validateChatImageFile } from "../../lib/chatStorage.js";

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

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0] || null,
    [threads, activeThreadId]
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
    const { messages: next, error: err } = await loadChatMessages(user, activeThread.id);
    setMessages(next);
    if (err) setError(err);
    setLoadingMessages(false);
  }, [enabled, user, activeThread?.id]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  useEffect(() => {
    if (!enabled || !activeThread?.id) return undefined;
    return subscribeChatMessages(activeThread.id, refreshMessages);
  }, [enabled, activeThread?.id, refreshMessages]);

  const sendMessage = useCallback(
    async ({ body, file }) => {
      if (!user?.id || !activeThread) return { ok: false, error: "No active conversation." };
      setSending(true);
      setError(null);

      let attachment = null;
      if (file) {
        const validation = validateChatImageFile(file);
        if (validation) {
          setSending(false);
          setError(validation);
          return { ok: false, error: validation };
        }
        const uploaded = await uploadChatAttachment(user.id, activeThread.id, file);
        if (uploaded.error) {
          setSending(false);
          setError(uploaded.error);
          return { ok: false, error: uploaded.error };
        }
        attachment = uploaded;
      }

      const { message, error: err } = await sendChatMessage(user, activeThread, { body, attachment });
      setSending(false);
      if (err) {
        setError(err);
        return { ok: false, error: err };
      }
      if (message) setMessages((prev) => [...prev, message]);
      return { ok: true, message };
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
    showThreadSwitcher: threads.length > 1
  };
}
