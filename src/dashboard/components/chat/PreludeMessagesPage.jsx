import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, ImagePlus, MessageCircle, Pencil, Send, Video, X } from "lucide-react";
import { findNextJoinableMeeting } from "../../../lib/zoomMeetingLinks.js";
import { loadLocalChatMessages } from "../../../lib/localChatStore.js";
import { usePreludeChatContext } from "../../context/PreludeChatContext.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { Avatar, EmptyState, SearchInput } from "../ui/index.jsx";
import UnreadCountBadge, { useUnreadBadgeDismiss } from "./UnreadCountBadge.jsx";
function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupMessages(messages) {
  const groups = [];
  let lastDay = "";
  let batch = null;

  messages.forEach((msg) => {
    const day = formatDateLabel(msg.createdAt);
    if (day !== lastDay) {
      groups.push({ type: "date", label: day });
      lastDay = day;
      batch = null;
    }
    const side = msg.isMine ? "me" : "them";
    if (batch && batch.side === side) {
      batch.items.push(msg);
    } else {
      batch = { type: "messages", side, items: [msg] };
      groups.push(batch);
    }
  });
  return groups;
}

function threadPreview(thread) {
  const cached = loadLocalChatMessages(thread);
  const last = cached[cached.length - 1];
  return last?.body || last?.attachmentName || "";
}

function threadLastActivity(thread) {
  const cached = loadLocalChatMessages(thread);
  const last = cached[cached.length - 1];
  return last?.created_at || last?.createdAt || null;
}

function EditComposer({ message, onCancel, onSave }) {
  const [value, setValue] = useState(message.body || "");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="dash-chat-edit">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(value);
          if (e.key === "Escape") onCancel();
        }}
        className="dash-chat-edit__input"
        aria-label="Edit message"
      />
      <button type="button" className="dash-btn dash-btn--primary dash-btn--sm" onClick={() => onSave(value)}>
        Save
      </button>
      <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function ConvoRow({ thread, active, unreadCount, preview, lastAt, onSelect }) {
  const { showBadge, badgeCount, dismissing, dismissBadge } = useUnreadBadgeDismiss(unreadCount);

  return (
    <button
      type="button"
      className={active ? "dash-convo-row dash-convo-row--active" : "dash-convo-row"}
      onClick={() => {
        if (unreadCount > 0) dismissBadge();
        onSelect(thread.id);
      }}
    >
      <Avatar name={thread.tabLabel || thread.label} size="sm" />
      <div className="dash-convo-row__body">
        <div className="dash-convo-row__head">
          <strong>{thread.tabLabel || thread.label}</strong>
          <time>{formatRelative(lastAt)}</time>
        </div>
        <span className="dash-convo-row__role">
          {thread.tabSublabel || thread.sublabel || thread.participantRole}
        </span>
        {preview ? <p className="dash-convo-row__preview">{preview}</p> : null}
      </div>
      {showBadge ? (
        <UnreadCountBadge
          count={badgeCount}
          dismissing={dismissing}
          className="dash-unread-badge--convo"
          aria-label={`${badgeCount} unread`}
        />
      ) : null}
    </button>
  );
}

export default function PreludeMessagesPage({ schedulePath, placeholder = "Write a message…" }) {
  const {
    enabled,
    threads,
    activeThread,
    activeThreadId,
    setActiveThreadId,
    messages,
    loadingMessages,
    loadingThreads,
    sending,
    error,
    setError,
    sendMessage,
    editingId,
    setEditingId,
    saveEdit,
    threadRevision,
    unreadByThread,
    markThreadRead
  } = usePreludeChatContext();
  const { meetings } = useDashboardData();

  const [q, setQ] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  const sortedThreads = useMemo(() => {
    const list = threads.filter((thread) => {
      if (!q) return true;
      const needle = q.toLowerCase();
      return (
        (thread.label || "").toLowerCase().includes(needle) ||
        (thread.sublabel || "").toLowerCase().includes(needle) ||
        (thread.tabLabel || "").toLowerCase().includes(needle) ||
        threadPreview(thread).toLowerCase().includes(needle)
      );
    });
    return [...list].sort((a, b) => {
      const aTime = new Date(threadLastActivity(a) || 0).getTime();
      const bTime = new Date(threadLastActivity(b) || 0).getTime();
      return bTime - aTime;
    });
  }, [threads, q, threadRevision, messages.length]);

  const groups = activeThread ? groupMessages(messages) : [];
  const nextMeeting = findNextJoinableMeeting(meetings);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeThreadId, messages.length]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  function selectThread(id) {
    setActiveThreadId(id);
    setMobileShowChat(true);
  }

  async function handleSend(e) {
    e?.preventDefault?.();
    if (sending) return;
    const trimmed = draft.trim();
    if (!trimmed && !pendingFile) return;
    const result = await sendMessage({ body: trimmed, file: pendingFile });
    if (result.ok) {
      setDraft("");
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  useEffect(() => {
    if (activeThreadId) {
      markThreadRead(activeThreadId);
    }
  }, [activeThreadId, messages.length, markThreadRead]);

  if (!enabled) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Messages unavailable"
        description="Chat is not available in this view."
      />
    );
  }

  return (
    <div className={`dash-chat-app ${mobileShowChat ? "dash-chat-app--mobile-chat" : ""}`}>
      <aside className={`dash-chat-app__list ${mobileShowChat ? "dash-chat-app__list--hidden-mobile" : ""}`}>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
        <div className="dash-chat-app__threads">
          {loadingThreads ? (
            <p className="dash-muted dash-chat-app__status">Loading conversations…</p>
          ) : sortedThreads.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No conversations" description="Messages with your assigned contacts will appear here." />
          ) : (
            sortedThreads.map((thread) => (
              <ConvoRow
                key={thread.id}
                thread={thread}
                active={thread.id === activeThreadId}
                unreadCount={unreadByThread[thread.id] || 0}
                preview={threadPreview(thread)}
                lastAt={threadLastActivity(thread)}
                onSelect={selectThread}
              />
            ))
          )}
        </div>
      </aside>

      <div className={`dash-chat-app__panel ${!mobileShowChat && sortedThreads.length ? "" : "dash-chat-app__panel--mobile"}`}>
        {activeThread ? (
          <>
            <header className="dash-chat-app__header">
              <button type="button" className="dash-chat-app__back lg:hidden" onClick={() => setMobileShowChat(false)} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar name={activeThread.tabLabel || activeThread.label} />
              <div className="dash-chat-app__header-text">
                <strong>{activeThread.label}</strong>
                <span>{activeThread.sublabel || activeThread.participantRole}</span>
              </div>
              {schedulePath ? (
                <div className="dash-chat-app__header-actions">
                  <Link to={schedulePath} className="dash-btn dash-btn--secondary dash-btn--sm">
                    <Calendar className="h-4 w-4" /> Schedule Zoom
                  </Link>
                  {nextMeeting?.zoomJoinUrl ? (
                    <a href={nextMeeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--primary dash-btn--sm">
                      <Video className="h-4 w-4" /> Join Meeting
                    </a>
                  ) : null}
                </div>
              ) : null}
            </header>

            <div className="dash-chat-app__messages" ref={scrollRef}>
              {loadingMessages ? (
                <p className="dash-muted dash-chat-app__status">Loading messages…</p>
              ) : groups.length === 0 ? (
                <EmptyState icon={MessageCircle} title="No messages yet" description="Start the conversation." />
              ) : (
                groups.map((g, idx) =>
                  g.type === "date" ? (
                    <div key={`d-${idx}`} className="dash-chat-date">{g.label}</div>
                  ) : (
                    <div key={`m-${idx}`} className={`dash-chat-group dash-chat-group--${g.side}`}>
                      {g.side === "them" ? <Avatar name={activeThread.label} size="sm" /> : null}
                      <div className="dash-chat-group__bubbles">
                        {g.items.map((msg) =>
                          editingId === msg.id ? (
                            <EditComposer
                              key={msg.id}
                              message={msg}
                              onCancel={() => setEditingId(null)}
                              onSave={(body) => saveEdit(msg.id, body)}
                            />
                          ) : (
                            <div key={msg.id} className={`dash-chat-bubble dash-chat-bubble--${g.side}`}>
                              {msg.attachmentUrl ? (
                                <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                  <img src={msg.attachmentUrl} alt={msg.attachmentName || "Shared image"} className="dash-chat-bubble__image" />
                                </a>
                              ) : null}
                              {msg.body ? <span>{msg.body}</span> : null}
                              {msg.isMine ? (
                                <button
                                  type="button"
                                  className="dash-chat-bubble__edit"
                                  onClick={() => setEditingId(msg.id)}
                                  aria-label="Edit message"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              ) : null}
                            </div>
                          )
                        )}
                        <div className="dash-chat-group__meta">
                          <time>{formatTime(g.items[g.items.length - 1].createdAt)}</time>
                          {g.items[g.items.length - 1].editedAt ? <span>edited</span> : null}
                        </div>
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            {error ? (
              <p className="dash-chat-app__error" role="alert">
                {error}
              </p>
            ) : null}

            {previewUrl ? (
              <div className="dash-chat-app__preview">
                <img src={previewUrl} alt="Attachment preview" />
                <button
                  type="button"
                  onClick={() => {
                    setPendingFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}

            <form className="dash-chat-app__composer" onSubmit={handleSend}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                className="dash-chat-app__file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  setPendingFile(file);
                  setError(null);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="dash-btn dash-btn--secondary dash-btn--icon"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach photo"
                disabled={sending}
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder={placeholder}
                disabled={sending}
              />
              <button type="submit" className="dash-btn dash-btn--primary dash-btn--icon" aria-label="Send" disabled={sending || (!draft.trim() && !pendingFile)}>
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <EmptyState icon={MessageCircle} title="Select a conversation" description="Choose a thread to start messaging." />
        )}
      </div>
    </div>
  );
}
