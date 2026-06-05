import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, MessageCircle, Paperclip, Send, Smile, Video } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { normalizeMessage, createOutgoingMessage, advanceMessageStatus } from "../lib/messageUtils.js";
import MessageReceipt from "./MessageReceipt.jsx";
import { Avatar, EmptyState, IconButton, PrimaryButton, SearchInput } from "./ui/index.jsx";

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
    const side = msg.sender === "me" ? "me" : "them";
    if (batch && batch.side === side) {
      batch.items.push(msg);
    } else {
      batch = { type: "messages", side, items: [msg] };
      groups.push(batch);
    }
  });
  return groups;
}

function normalizeConversation(c) {
  return {
    ...c,
    messages: (c.messages || []).map((m) => normalizeMessage(m, c.id))
  };
}

export default function MessagesPanel({
  conversations = [],
  meetings = [],
  schedulePath = "/dashboard/student/mentor",
  placeholder = "Write a message…"
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState(conversations[0]?.id);
  const [threads, setThreads] = useState(() => conversations.map(normalizeConversation));
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const statusTimers = useRef([]);

  useEffect(() => {
    setThreads(conversations.map(normalizeConversation));
    if (!conversations.find((c) => c.id === activeId)) setActiveId(conversations[0]?.id);
  }, [conversations, activeId]);

  useEffect(() => () => statusTimers.current.forEach(clearTimeout), []);

  const sorted = useMemo(() => {
    const list = threads.filter(
      (c) =>
        !q ||
        c.participant.name.toLowerCase().includes(q.toLowerCase()) ||
        c.messages.some((m) => (m.body || m.text || "").toLowerCase().includes(q.toLowerCase()))
    );
    return [...list].sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }, [threads, q]);

  const active = sorted.find((c) => c.id === activeId) || sorted[0];
  const groups = active ? groupMessages(active.messages) : [];
  const nextMeeting = meetings.find((m) => m.zoomJoinUrl) || (active?.nextZoomUrl ? { zoomJoinUrl: active.nextZoomUrl } : null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.id, active?.messages?.length, threads]);

  function selectConversation(id) {
    setActiveId(id);
    setMobileShowChat(true);
    setThreads((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  }

  function updateMessageInThread(convId, msgId, updater) {
    setThreads((prev) =>
      prev.map((c) =>
        c.id !== convId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) => (m.id === msgId ? updater(m) : m)),
              lastActivity: new Date().toISOString()
            }
      )
    );
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || !active) return;
    const msg = createOutgoingMessage(active.id, text);
    setThreads((prev) =>
      prev.map((c) =>
        c.id === active.id ? { ...c, messages: [...c.messages, msg], lastActivity: msg.createdAt } : c
      )
    );
    setDraft("");

    statusTimers.current.push(
      setTimeout(() => updateMessageInThread(active.id, msg.id, (m) => advanceMessageStatus(m, "sent")), 450)
    );
    statusTimers.current.push(
      setTimeout(() => updateMessageInThread(active.id, msg.id, (m) => advanceMessageStatus(m, "delivered")), 1100)
    );
  }

  function onComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const viewerLabel = user?.role === "mentor" ? "Mentor" : "Student";

  return (
    <div className={`dash-chat-app ${mobileShowChat ? "dash-chat-app--mobile-chat" : ""}`}>
      <aside className={`dash-chat-app__list ${mobileShowChat ? "dash-chat-app__list--hidden-mobile" : ""}`}>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
        <div className="dash-chat-app__threads">
          {sorted.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No conversations" description="Messages with your assigned contacts will appear here." />
          ) : (
            sorted.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <button
                  key={c.id}
                  type="button"
                  className={c.id === active?.id ? "dash-convo-row dash-convo-row--active" : "dash-convo-row"}
                  onClick={() => selectConversation(c.id)}
                >
                  <Avatar name={c.participant.name} size="sm" />
                  <div className="dash-convo-row__body">
                    <div className="dash-convo-row__head">
                      <strong>{c.participant.name}</strong>
                      <time>{formatRelative(c.lastActivity)}</time>
                    </div>
                    <span className="dash-convo-row__role">{c.participant.role} · {c.participant.context}</span>
                    <p className="dash-convo-row__preview">{last?.body || last?.text}</p>
                  </div>
                  {c.unread > 0 ? <span className="dash-convo-row__badge">{c.unread}</span> : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className={`dash-chat-app__panel ${!mobileShowChat && sorted.length ? "" : "dash-chat-app__panel--mobile"}`}>
        {active ? (
          <>
            <header className="dash-chat-app__header">
              <button type="button" className="dash-chat-app__back lg:hidden" onClick={() => setMobileShowChat(false)} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar name={active.participant.name} />
              <div className="dash-chat-app__header-text">
                <strong>{active.participant.name}</strong>
                <span>{active.participant.role} · {active.participant.context}</span>
                <span className="dash-chat-app__status">{active.participant.online ? "Online" : active.participant.status}</span>
              </div>
              <div className="dash-chat-app__header-actions">
                <Link to={schedulePath} className="dash-btn dash-btn--secondary dash-btn--sm">
                  <Calendar className="h-4 w-4" /> Schedule Zoom
                </Link>
                {nextMeeting?.zoomJoinUrl ? (
                  <a href={nextMeeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--primary dash-btn--sm">
                    <Video className="h-4 w-4" /> Join Zoom
                  </a>
                ) : null}
              </div>
            </header>

            <div className="dash-chat-app__messages" ref={scrollRef}>
              {groups.map((g, idx) =>
                g.type === "date" ? (
                  <div key={`d-${idx}`} className="dash-chat-date">{g.label}</div>
                ) : (
                  <div key={`m-${idx}`} className={`dash-chat-group dash-chat-group--${g.side}`}>
                    {g.side === "them" ? <Avatar name={active.participant.name} size="sm" /> : null}
                    <div className="dash-chat-group__bubbles">
                      {g.items.map((msg) => (
                        <div key={msg.id} className={`dash-chat-bubble dash-chat-bubble--${g.side}`}>
                          {msg.body || msg.text}
                        </div>
                      ))}
                      <div className="dash-chat-group__meta">
                        <time>{formatTime(g.items[g.items.length - 1].createdAt)}</time>
                        {g.side === "me" ? <MessageReceipt status={g.items[g.items.length - 1].status} /> : null}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <form
              className="dash-chat-app__composer"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <IconButton label="Attach file" type="button"><Paperclip className="h-4 w-4" /></IconButton>
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={placeholder}
              />
              <IconButton label="Emoji" type="button"><Smile className="h-4 w-4" /></IconButton>
              <PrimaryButton type="submit" className="dash-btn--icon" aria-label="Send">
                <Send className="h-4 w-4" />
              </PrimaryButton>
            </form>
          </>
        ) : (
          <EmptyState icon={MessageCircle} title="Select a conversation" description={`Choose a thread to message as ${viewerLabel.toLowerCase()}.`} />
        )}
      </div>
    </div>
  );
}
