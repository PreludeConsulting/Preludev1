import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ImagePlus, MessageCircle, Pencil, Send, X } from "lucide-react";
import { Avatar } from "../ui/index.jsx";
import { usePreludeChatContext } from "../../context/PreludeChatContext.jsx";
import UnreadCountBadge, { useUnreadBadgeDismiss } from "./UnreadCountBadge.jsx";

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDate(messages) {
  const groups = [];
  let lastDay = "";
  messages.forEach((msg) => {
    const day = formatDateLabel(msg.createdAt);
    if (day !== lastDay) {
      groups.push({ type: "date", key: `d-${day}`, label: day });
      lastDay = day;
    }
    groups.push({ type: "message", key: msg.id, msg });
  });
  return groups;
}

function ChatBubble({ message, onEdit }) {
  const side = message.isMine ? "me" : "them";

  return (
    <div className={`dash-msg-fab-bubble dash-msg-fab-bubble--${side}`}>
      {message.attachmentUrl ? (
        <a
          href={message.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dash-msg-fab-bubble__image-link"
        >
          <img src={message.attachmentUrl} alt={message.attachmentName || "Shared image"} className="dash-msg-fab-bubble__image" />
        </a>
      ) : null}
      {message.body ? <p className="dash-msg-fab-bubble__text">{message.body}</p> : null}
      <div className="dash-msg-fab-bubble__meta">
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        {message.editedAt ? <span className="dash-msg-fab-bubble__edited">edited</span> : null}
        {message.isMine ? (
          <button type="button" className="dash-msg-fab-bubble__edit" onClick={() => onEdit(message)} aria-label="Edit message">
            <Pencil size={12} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EditBar({ message, onCancel, onSave }) {
  const [value, setValue] = useState(message.body || "");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="dash-msg-fab-edit">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(value);
          if (e.key === "Escape") onCancel();
        }}
        className="dash-msg-fab-edit__input"
        aria-label="Edit message"
      />
      <button type="button" className="dash-msg-fab-edit__save" onClick={() => onSave(value)}>
        Save
      </button>
      <button type="button" className="dash-msg-fab-edit__cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function ChatPanel({
  open,
  onClose,
  threads,
  activeThread,
  activeThreadId,
  setActiveThreadId,
  messages,
  loadingMessages,
  sending,
  error,
  showThreadSwitcher,
  sendMessage,
  editingId,
  setEditingId,
  saveEdit,
  setError
}) {
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, open, activeThreadId]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  async function handleSend() {
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

  const groups = groupByDate(messages);

  return (
    <div
      className={`dash-msg-fab__panel${open ? " dash-msg-fab__panel--open" : ""}`}
      role="dialog"
      aria-label="Messages"
      aria-hidden={!open}
    >
      <header className="dash-msg-fab__header">
        <div className="dash-msg-fab__header-main">
          {activeThread ? (
            <>
              <Avatar name={activeThread.tabLabel || activeThread.label} avatarUrl={activeThread.avatarUrl} size="sm" />
              <div className="dash-msg-fab__header-text">
                <strong>{activeThread.label}</strong>
                <span>{activeThread.sublabel || activeThread.participantRole}</span>
              </div>
            </>
          ) : (
            <div className="dash-msg-fab__header-text">
              <strong>Messages</strong>
              <span>Prelude chat</span>
            </div>
          )}
        </div>
        <button type="button" className="dash-msg-fab__close" onClick={onClose} aria-label="Close chat">
          <X size={18} />
        </button>
      </header>

      {showThreadSwitcher ? (
        <div className="dash-msg-fab__tabs" role="tablist" aria-label="Conversations">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              role="tab"
              aria-selected={thread.id === activeThreadId}
              className={`dash-msg-fab__tab${thread.id === activeThreadId ? " dash-msg-fab__tab--active" : ""}`}
              onClick={() => setActiveThreadId(thread.id)}
            >
              <span className="dash-msg-fab__tab-label">{thread.tabLabel || thread.label}</span>
              <span className="dash-msg-fab__tab-role">{thread.tabSublabel || thread.sublabel}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="dash-msg-fab__messages" ref={scrollRef}>
        {loadingMessages ? (
          <p className="dash-msg-fab__status">Loading messages…</p>
        ) : messages.length === 0 ? (
          <div className="dash-msg-fab__empty">
            <MessageCircle size={28} strokeWidth={1.5} />
            <strong>No messages yet</strong>
            <p>Start the conversation.</p>
          </div>
        ) : (
          groups.map((g) =>
            g.type === "date" ? (
              <div key={g.key} className="dash-msg-fab__date">
                {g.label}
              </div>
            ) : editingId === g.msg.id ? (
              <EditBar
                key={g.key}
                message={g.msg}
                onCancel={() => setEditingId(null)}
                onSave={(body) => saveEdit(g.msg.id, body)}
              />
            ) : (
              <ChatBubble key={g.key} message={g.msg} onEdit={(m) => setEditingId(m.id)} />
            )
          )
        )}
      </div>

      {error ? (
        <p className="dash-msg-fab__error" role="alert">
          {error}
        </p>
      ) : null}

      {previewUrl ? (
        <div className="dash-msg-fab__preview">
          <img src={previewUrl} alt="Attachment preview" />
          <button type="button" onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Remove image">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <footer className="dash-msg-fab__composer">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
          className="dash-msg-fab__file-input"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (!file) return;
            setPendingFile(file);
            setError?.(null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="dash-msg-fab__attach"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach photo"
          disabled={!activeThread || sending}
        >
          <ImagePlus size={18} />
        </button>
        <input
          type="text"
          className="dash-msg-fab__input"
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={!activeThread || sending}
        />
        <button
          type="button"
          className="dash-msg-fab__send"
          onClick={handleSend}
          disabled={!activeThread || sending || (!draft.trim() && !pendingFile)}
          aria-label="Send message"
        >
          <Send size={17} />
        </button>
      </footer>
    </div>
  );
}

export default function PreludeFloatingChat() {
  const location = useLocation();
  const {
    enabled,
    open,
    setOpen,
    threads,
    activeThread,
    activeThreadId,
    setActiveThreadId,
    messages,
    loadingMessages,
    sending,
    error,
    setError,
    showThreadSwitcher,
    sendMessage,
    editingId,
    setEditingId,
    saveEdit,
    markThreadRead,
    unreadTotal
  } = usePreludeChatContext();
  const { showBadge, badgeCount, dismissing, dismissBadge } = useUnreadBadgeDismiss(unreadTotal);
  const settingsPage = /\/settings\/?$/.test(location.pathname);

  useEffect(() => {
    if (open && activeThreadId) {
      markThreadRead(activeThreadId);
    }
  }, [open, activeThreadId, messages.length, markThreadRead]);

  if (!enabled) return null;

  const node = (
    <div className={`dash-msg-fab${open ? " dash-msg-fab--open" : ""}${settingsPage ? " dash-msg-fab--settings" : ""}`}>
      <div className="dash-msg-fab__anchor">
        <button
          type="button"
          className="dash-msg-fab__toggle"
          onClick={() => {
            if (unreadTotal > 0) dismissBadge();
            setOpen(true);
          }}
          aria-hidden={open}
          tabIndex={open ? -1 : 0}
          aria-label={unreadTotal > 0 ? `Open messages, ${unreadTotal} unread` : "Open messages"}
        >
          <MessageCircle size={22} strokeWidth={1.75} />
          {!open && showBadge ? (
            <UnreadCountBadge
              count={badgeCount}
              dismissing={dismissing}
              className="dash-unread-badge--fab"
              aria-hidden="true"
            />
          ) : null}
        </button>
        <ChatPanel
          open={open}
          onClose={() => setOpen(false)}
        threads={threads}
        activeThread={activeThread}
        activeThreadId={activeThreadId}
        setActiveThreadId={setActiveThreadId}
        messages={messages}
        loadingMessages={loadingMessages}
        sending={sending}
        error={error}
        showThreadSwitcher={showThreadSwitcher}
        sendMessage={sendMessage}
        editingId={editingId}
        setEditingId={setEditingId}
        saveEdit={saveEdit}
        setError={setError}
        />
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
