import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Calendar, Check, CheckCheck, ChevronRight, ImagePlus, MessageCircle, Pencil, Send, Trash2, Users, Video, X } from "lucide-react";
import { findNextJoinableMeeting } from "../../../lib/zoomMeetingLinks.js";
import { chatMessagePreviewText, sanitizeThreadPreview } from "../../../lib/chatAttachments.js";
import { CHAT_ATTACHMENT_ACCEPT } from "../../../lib/chatStorage.js";
import { loadLocalChatMessages } from "../../../lib/localChatStore.js";
import MessageAttachment from "./MessageAttachment.jsx";
import { usePreludeChatContext } from "../../context/PreludeChatContext.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { Avatar, EmptyState, SearchInput } from "../ui/index.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import MessagesMentorNetworkPanel from "./MessagesMentorNetworkPanel.jsx";
import { usePlanAccess } from "../../hooks/usePlanAccess.js";
import { roleFromUser } from "../../../lib/dashboardRoutes.js";

function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const EDIT_WINDOW_MS = 2 * 60 * 1000;

function canEditMessage(msg, now) {
  if (!msg?.isMine || !msg.createdAt) return false;
  return now - new Date(msg.createdAt).getTime() <= EDIT_WINDOW_MS;
}

function canDeleteMessage(msg) {
  return Boolean(
    msg?.isMine &&
    msg.status !== "sending" &&
    msg.status !== "failed" &&
    !String(msg.id || "").startsWith("local-")
  );
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
      groups.push({ type: "date", label: day, key: `date-${day}` });
      lastDay = day;
      batch = null;
    }
    const side = msg.isMine ? "me" : "them";
    if (batch && batch.side === side) {
      batch.items.push(msg);
    } else {
      // Keyed by its first message so a group keeps its identity as the thread grows.
      batch = { type: "messages", side, items: [msg], key: `group-${msg.id}` };
      groups.push(batch);
    }
  });
  return groups;
}

function threadPreview(thread) {
  const cached = loadLocalChatMessages(thread);
  const last = cached[cached.length - 1];
  return chatMessagePreviewText(last) || sanitizeThreadPreview(thread?.lastMessagePreview);
}

function threadLastActivity(thread) {
  const cached = loadLocalChatMessages(thread);
  const last = cached[cached.length - 1];
  return last?.created_at || last?.createdAt || thread?.lastMessageAt || null;
}

function EditComposer({ message, onCancel, onSave }) {
  const [value, setValue] = useState(message.body || "");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="msg-edit">
      <button type="button" className="msg-edit__cancel" onClick={onCancel} aria-label="Cancel edit">
        <X size={14} />
      </button>
      <input ref={inputRef} type="text" value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(value); if (e.key === "Escape") onCancel(); }}
        className="msg-edit__input" aria-label="Edit message" />
      <button type="button" className="msg-edit__save" onClick={() => onSave(value)} aria-label="Save edit" disabled={!value.trim()}>
        <Check size={14} />
      </button>
    </div>
  );
}

function MessageStatus({ status, onRetry }) {
  if (status === "sending") return <span className="msg-status msg-status--sending">Sending…</span>;
  if (status === "failed") {
    return (
      <span className="msg-status msg-status--failed">
        Not sent
        <button type="button" className="msg-status__retry" onClick={onRetry}>Retry</button>
      </span>
    );
  }
  if (status === "delivered") return <span className="msg-status"><CheckCheck size={12} /></span>;
  if (status === "read") return <span className="msg-status msg-status--read"><CheckCheck size={12} /></span>;
  return <span className="msg-status"><Check size={12} /></span>;
}

function ConvoRow({ thread, active, unreadCount, preview, lastAt, onSelect }) {
  return (
    <button
      type="button"
      className={
        "msg-convo" +
        (active ? " msg-convo--active" : "") +
        (unreadCount > 0 ? " msg-convo--unread" : "")
      }
      onClick={() => onSelect(thread.id)}
    >
      <div className="msg-convo__avatar">
        <Avatar name={thread.tabLabel || thread.label} avatarUrl={thread.avatarUrl} size="sm" />
        {thread.online ? <span className="msg-convo__online" /> : null}
      </div>
      <div className="msg-convo__body">
        <div className="msg-convo__head">
          <span className="msg-convo__name">{thread.tabLabel || thread.label}</span>
          {lastAt ? <time className="msg-convo__time">{formatRelative(lastAt)}</time> : null}
        </div>
        <span className="msg-convo__role">{thread.tabSublabel || thread.sublabel || thread.participantRole}</span>
        {preview ? <p className="msg-convo__preview">{preview}</p> : null}
      </div>
      {unreadCount > 0 ? <span className="msg-convo__badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
    </button>
  );
}

export default function PreludeMessagesPage({ schedulePath, placeholder = "Write a message…" }) {
  const { user } = useAuth();
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
    deletingMessageId,
    saveEdit,
    deleteMessage,
    threadRevision,
    unreadByThread,
    markThreadRead,
    retryMessage,
    lastOutgoingAt
  } = usePreludeChatContext();
  const { meetings, mentor } = useDashboardData();
  const { canAccess } = usePlanAccess();
  const canMessageNetwork = canAccess("fullMentorNetworkMessaging");
  const isMentor = roleFromUser(user) === "mentor";
  const hasAssignedMentor = Boolean(
    mentor?.status === "assigned" ||
      mentor?.userId ||
      mentor?.mentorUserId ||
      mentor?.id
  );
  const showMentorNetworkBrowse = !isMentor;

  const [q, setQ] = useState("");
  const [panel, setPanel] = useState("inbox");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

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

  // Jump to the newest message when opening a conversation, when the reader is
  // already at the bottom, or right after this user sends — never while they are
  // scrolled up reading history.
  useEffect(() => {
    if (!activeThreadId) return undefined;
    const el = scrollRef.current;
    const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 120 : true;
    const ownSend = lastOutgoingAt && Date.now() - lastOutgoingAt < 1000;
    if (!nearBottom && !ownSend) return undefined;
    const timer = setTimeout(() => {
      const target = scrollRef.current;
      if (target) target.scrollTop = target.scrollHeight;
    }, 50);
    return () => clearTimeout(timer);
  }, [activeThreadId, messages.length, lastOutgoingAt]);

  useEffect(() => {
    if (!pendingFile || !/^image\//i.test(pendingFile.type || "")) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    // Revoke after the paint that removed the preview, never while it is on screen.
    return () => {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    };
  }, [pendingFile]);

  function selectThread(id) {
    setPanel("inbox");
    setActiveThreadId(id);
    setMobileShowChat(true);
  }

  function handleBack() {
    setMobileShowChat(false);
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

  async function handleDelete(message) {
    const confirmed = window.confirm("Delete this message? It will be removed for everyone.");
    if (!confirmed) return;
    await deleteMessage(message.id);
  }

  function handleComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  function handleComposerChange(e) {
    setDraft(e.target.value);
    if (composerRef.current) {
      composerRef.current.style.height = "auto";
      composerRef.current.style.height = Math.min(composerRef.current.scrollHeight, 120) + "px";
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
    <div className="msg-page">
      {/* Sidebar */}
      <aside className={"msg-sidebar" + (mobileShowChat ? " msg-sidebar--hidden" : "")}>
        <div className="msg-sidebar__header">
          <h2 className="msg-sidebar__title">Messages</h2>
        </div>

        <div className="msg-sidebar__search">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
        </div>

        <div className="msg-sidebar__threads">
          {loadingThreads ? (
            <div className="msg-sidebar__status">
              <span className="msg-loading-dot" />
              <span className="msg-loading-dot" />
              <span className="msg-loading-dot" />
            </div>
          ) : sortedThreads.length === 0 ? (
            <div className="msg-empty-threads">
              <div className="msg-empty-threads__icon">
                <MessageCircle size={24} />
              </div>
              <p className="msg-empty-threads__title">No conversations yet</p>
              <p className="msg-empty-threads__desc">
                {isMentor
                  ? "Messages with your assigned students will appear here."
                  : hasAssignedMentor
                    ? "Your assigned mentor conversation will appear here once messaging is ready."
                    : "Messages will appear after you connect with a mentor."}
              </p>
              {showMentorNetworkBrowse ? (
                <button
                  type="button"
                  className="msg-empty-threads__action"
                  onClick={() => { setPanel("network"); setMobileShowChat(true); }}
                >
                  <Users size={14} /> Browse mentor network
                </button>
              ) : null}
            </div>
          ) : (
            sortedThreads.map((thread) => (
              <ConvoRow
                key={thread.id}
                thread={thread}
                active={panel === "inbox" && thread.id === activeThreadId}
                unreadCount={unreadByThread[thread.id] || 0}
                preview={threadPreview(thread)}
                lastAt={threadLastActivity(thread)}
                onSelect={selectThread}
              />
            ))
          )}
        </div>

        {showMentorNetworkBrowse ? (
          <button
            type="button"
            className={"msg-sidebar__network" + (panel === "network" ? " msg-sidebar__network--active" : "")}
            onClick={() => { setPanel("network"); setMobileShowChat(true); }}
          >
            <Users size={15} />
            <span>View full mentor network</span>
            <ChevronRight size={14} />
          </button>
        ) : null}
      </aside>

      {/* Main panel */}
      <div className={"msg-main" + (mobileShowChat ? " msg-main--visible" : "")}>
        {!isMentor && panel === "network" ? (
          <MessagesMentorNetworkPanel
            canMessage={canMessageNetwork}
            onBack={() => { setPanel("inbox"); setMobileShowChat(false); }}
          />
        ) : activeThread ? (
          <>
            {/* Chat header */}
            <header className="msg-header">
              <button type="button" className="msg-header__back" onClick={handleBack} aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <Avatar name={activeThread.tabLabel || activeThread.label} avatarUrl={activeThread.avatarUrl} />
              <div className="msg-header__info">
                <strong className="msg-header__name">{activeThread.tabLabel || activeThread.label}</strong>
                <span className="msg-header__meta">
                  {activeThread.tabSublabel || activeThread.sublabel || activeThread.participantRole || "Mentor"}
                </span>
              </div>
              {schedulePath ? (
                <div className="msg-header__actions">
                  {nextMeeting?.zoomJoinUrl ? (
                    <a href={nextMeeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="msg-btn msg-btn--primary msg-btn--sm" title="Join Meeting">
                      <Video size={15} />
                    </a>
                  ) : null}
                  <Link to={schedulePath} className="msg-btn msg-btn--outline msg-btn--sm" title="Schedule meeting">
                    <Calendar size={15} />
                  </Link>
                </div>
              ) : null}
            </header>

            {/* Messages area */}
            <div className="msg-messages" ref={scrollRef}>
              {loadingMessages ? (
                <div className="msg-messages__loading">
                  <div className="msg-loading-dots">
                    <span className="msg-loading-dot" />
                    <span className="msg-loading-dot" />
                    <span className="msg-loading-dot" />
                  </div>
                </div>
              ) : groups.length === 0 ? (
                <div className="msg-empty-chat">
                  <div className="msg-empty-chat__icon">
                    <MessageCircle size={28} />
                  </div>
                  <p className="msg-empty-chat__title">No messages yet</p>
                  <p className="msg-empty-chat__desc">Send your first message to start the conversation.</p>
                </div>
              ) : (
                groups.map((g) =>
                  g.type === "date" ? (
                    <div key={g.key} className="msg-date">{g.label}</div>
                  ) : (
                    <div key={g.key} className={"msg-group msg-group--" + g.side}>
                      <div className="msg-group__bubbles">
                        {g.items.map((msg) =>
                          editingId === msg.id ? (
                            <EditComposer
                              key={msg.id}
                              message={msg}
                              onCancel={() => setEditingId(null)}
                              onSave={(body) => saveEdit(msg.id, body)}
                            />
                          ) : (
                            <div key={msg.id} className="msg-bubble-wrap">
                              <div className={"msg-bubble msg-bubble--" + g.side}>
                                <MessageAttachment message={msg} />
                                {msg.body ? <span className="msg-bubble__text">{msg.body}</span> : null}
                                {canEditMessage(msg, now) ? (
                                  <button type="button" className="msg-bubble__edit" onClick={() => setEditingId(msg.id)} aria-label="Edit message">
                                    <Pencil size={12} />
                                  </button>
                                ) : null}
                              </div>
                              <div className={"msg-bubble__meta msg-bubble__meta--" + g.side}>
                                {msg.editedAt ? <span className="msg-edited">edited</span> : null}
                                {g.side === "me" ? (
                                  <MessageStatus
                                    status={msg.status}
                                    onRetry={() => retryMessage?.(msg.clientId || msg.id)}
                                  />
                                ) : null}
                                <time className="msg-time">{formatTime(msg.createdAt)}</time>
                                {canDeleteMessage(msg) ? (
                                  <button
                                    type="button"
                                    className="msg-bubble__delete"
                                    onClick={() => handleDelete(msg)}
                                    disabled={deletingMessageId === msg.id}
                                    aria-label="Delete message"
                                    title="Delete message"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            {/* Error banner */}
            {error ? (
              <div className="msg-error" role="alert">
                <span>{error}</span>
                {error.includes("offline") || error.includes("connection") ? (
                  <button type="button" className="msg-error__retry" onClick={() => setError(null)}>Dismiss</button>
                ) : null}
              </div>
            ) : null}

            {/* Attachment preview */}
            {pendingFile ? (
              <div className="msg-preview">
                {previewUrl ? (
                  <img src={previewUrl} alt="Attachment preview" />
                ) : (
                  <span className="msg-preview__file">{pendingFile.name}</span>
                )}
                <button type="button" onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Remove attachment">
                  <X size={16} />
                </button>
              </div>
            ) : null}

            {/* Composer */}
            <form className="msg-composer" onSubmit={handleSend}>
              <input ref={fileRef} type="file" accept={CHAT_ATTACHMENT_ACCEPT} className="msg-composer__file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  setPendingFile(file);
                  setError(null);
                  e.target.value = "";
                }} />
              <button type="button" className="msg-composer__attach" onClick={() => fileRef.current?.click()} aria-label="Attach a photo or file" disabled={sending}>
                <ImagePlus size={20} />
              </button>
              <textarea
                ref={composerRef}
                rows={1}
                value={draft}
                onChange={handleComposerChange}
                onKeyDown={handleComposerKeyDown}
                placeholder={placeholder}
                disabled={sending}
                className="msg-composer__input"
              />
              <button type="submit" className="msg-composer__send" aria-label="Send" disabled={sending || (!draft.trim() && !pendingFile)}>
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="msg-empty-select">
            <div className="msg-empty-select__icon">
              <MessageCircle size={36} />
            </div>
            <p className="msg-empty-select__title">Select a conversation</p>
            <p className="msg-empty-select__desc">
              {isMentor ? "Choose a conversation to start messaging." : "Choose a conversation with your mentor."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
