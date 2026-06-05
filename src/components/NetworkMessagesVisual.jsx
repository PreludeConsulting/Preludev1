import { Calendar, Paperclip, Search, Send, Smile, Video } from "lucide-react";

const MENTOR = {
  name: "Maya Patel",
  initials: "MP",
  role: "Mentor",
  context: "Georgia Tech · CS"
};

const SIDEBAR_THREADS = [
  {
    id: "maya",
    active: true,
    name: MENTOR.name,
    initials: MENTOR.initials,
    meta: `${MENTOR.role} · ${MENTOR.context}`,
    preview: "Great progress on your college list — let's focus on your essay strategy next.",
    time: "2h ago",
    unread: 1
  },
  {
    id: "alex",
    active: false,
    name: "Alex Kim",
    initials: "AK",
    meta: "Student · 12th grade",
    preview: "Working on it — I'll share the doc tomorrow morning.",
    time: "1d ago",
    unread: 0
  }
];

const CHAT_MESSAGES = [
  { side: "them", text: "Hi Jordan — let's refine your reach schools on Thursday." },
  { side: "me", text: "Sounds good. I'll update my college list tiers tonight." },
  { side: "them", text: "Great progress on your college list — let's focus on your essay strategy next." }
];

function MockAvatar({ initials, size = "md" }) {
  return <span className={`network-messages-mock__avatar network-messages-mock__avatar--${size}`}>{initials}</span>;
}

export default function NetworkMessagesVisual() {
  return (
    <div className="network-visual" aria-hidden="true">
      <div className="network-visual__frame">
        <div className="network-messages-mock">
          <aside className="network-messages-mock__sidebar">
            <label className="network-messages-mock__search">
              <Search className="network-messages-mock__search-icon" strokeWidth={2} aria-hidden="true" />
              <span className="network-messages-mock__search-text">Search conversations…</span>
            </label>
            <div className="network-messages-mock__threads">
              {SIDEBAR_THREADS.map((thread) => (
                <div
                  key={thread.id}
                  className={
                    thread.active
                      ? "network-messages-mock__thread network-messages-mock__thread--active"
                      : "network-messages-mock__thread"
                  }
                >
                  <MockAvatar initials={thread.initials} size="sm" />
                  <div className="network-messages-mock__thread-body">
                    <div className="network-messages-mock__thread-head">
                      <strong>{thread.name}</strong>
                      <time>{thread.time}</time>
                    </div>
                    <span className="network-messages-mock__thread-meta">{thread.meta}</span>
                    <p className="network-messages-mock__thread-preview">{thread.preview}</p>
                  </div>
                  {thread.unread > 0 ? (
                    <span className="network-messages-mock__thread-badge">{thread.unread}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>

          <div className="network-messages-mock__panel">
            <header className="network-messages-mock__header">
              <MockAvatar initials={MENTOR.initials} />
              <div className="network-messages-mock__header-text">
                <strong>{MENTOR.name}</strong>
                <span>
                  {MENTOR.role} · {MENTOR.context}
                </span>
                <span className="network-messages-mock__status">Online</span>
              </div>
              <div className="network-messages-mock__header-actions">
                <span className="network-messages-mock__btn network-messages-mock__btn--secondary">
                  <Calendar strokeWidth={2} aria-hidden="true" />
                  Schedule Zoom
                </span>
                <span className="network-messages-mock__btn network-messages-mock__btn--primary">
                  <Video strokeWidth={2} aria-hidden="true" />
                  Join Zoom
                </span>
              </div>
            </header>

            <div className="network-messages-mock__messages">
              {CHAT_MESSAGES.map((msg) => (
                <div
                  key={msg.text}
                  className={`network-messages-mock__group network-messages-mock__group--${msg.side}`}
                >
                  {msg.side === "them" ? <MockAvatar initials={MENTOR.initials} size="sm" /> : null}
                  <div className="network-messages-mock__bubble-wrap">
                    <div className={`network-messages-mock__bubble network-messages-mock__bubble--${msg.side}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="network-messages-mock__composer">
              <span className="network-messages-mock__composer-icon" aria-hidden="true">
                <Paperclip strokeWidth={2} />
              </span>
              <div className="network-messages-mock__composer-input">Write a message…</div>
              <span className="network-messages-mock__composer-icon" aria-hidden="true">
                <Smile strokeWidth={2} />
              </span>
              <span className="network-messages-mock__composer-send" aria-hidden="true">
                <Send strokeWidth={2} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
