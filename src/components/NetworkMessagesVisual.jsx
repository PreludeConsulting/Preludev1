import { Calendar, Paperclip, Search, Send, Smile, Video } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const MENTOR = {
  name: "Maya Patel",
  initials: "MP"
};

const SIDEBAR_THREADS = [
  {
    id: "maya",
    active: true,
    name: MENTOR.name,
    initials: MENTOR.initials,
    unread: 1
  },
  {
    id: "alex",
    active: false,
    name: "Alex Kim",
    initials: "AK",
    unread: 0
  }
];

const CHAT_SIDES = ["them", "me", "them"];

function MockAvatar({ initials, size = "md" }) {
  return <span className={`network-messages-mock__avatar network-messages-mock__avatar--${size}`}>{initials}</span>;
}

export default function NetworkMessagesVisual() {
  const { t } = useLanguage();
  const threadCopy = t("network.messagesVisual.threads");
  const chatMessages = t("network.messagesVisual.messages");

  return (
    <div className="network-visual" aria-hidden="true">
      <div className="network-visual__frame">
        <div className="network-messages-mock">
          <aside className="network-messages-mock__sidebar">
            <label className="network-messages-mock__search">
              <Search className="network-messages-mock__search-icon" strokeWidth={2} aria-hidden="true" />
              <span className="network-messages-mock__search-text">{t("network.messagesVisual.searchPlaceholder")}</span>
            </label>
            <div className="network-messages-mock__threads">
              {SIDEBAR_THREADS.map((thread, index) => (
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
                      <time>{threadCopy[index].time}</time>
                    </div>
                    <span className="network-messages-mock__thread-meta">
                      {index === 0 ? t("network.messagesVisual.mentorMeta") : t("network.messagesVisual.studentMeta")}
                    </span>
                    <p className="network-messages-mock__thread-preview">{threadCopy[index].preview}</p>
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
                <span>{t("network.messagesVisual.mentorMeta")}</span>
                <span className="network-messages-mock__status">{t("network.messagesVisual.status")}</span>
              </div>
              <div className="network-messages-mock__header-actions">
                <span className="network-messages-mock__btn network-messages-mock__btn--secondary">
                  <Calendar strokeWidth={2} aria-hidden="true" />
                  {t("network.messagesVisual.scheduleZoom")}
                </span>
                <span className="network-messages-mock__btn network-messages-mock__btn--primary">
                  <Video strokeWidth={2} aria-hidden="true" />
                  {t("network.messagesVisual.joinZoom")}
                </span>
              </div>
            </header>

            <div className="network-messages-mock__messages">
              {CHAT_SIDES.map((side, index) => (
                <div
                  key={`${side}-${index}`}
                  className={`network-messages-mock__group network-messages-mock__group--${side}`}
                >
                  {side === "them" ? <MockAvatar initials={MENTOR.initials} size="sm" /> : null}
                  <div className="network-messages-mock__bubble-wrap">
                    <div className={`network-messages-mock__bubble network-messages-mock__bubble--${side}`}>
                      {chatMessages[index]}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="network-messages-mock__composer">
              <span className="network-messages-mock__composer-icon" aria-hidden="true">
                <Paperclip strokeWidth={2} />
              </span>
              <div className="network-messages-mock__composer-input">
                {t("network.messagesVisual.composerPlaceholder")}
              </div>
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
