import { Calendar } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext.jsx";

const CHAT_MESSAGES = [
  {
    from: "jordan",
    name: "Jordan",
    initials: "JL"
  },
  {
    from: "maya",
    name: "Maya",
    initials: "MP"
  },
  {
    from: "maya",
    name: "Maya",
    initials: "MP"
  },
  {
    from: "jordan",
    name: "Jordan",
    initials: "JL"
  },
  {
    from: "maya",
    name: "Maya",
    initials: "MP"
  }
];

const STAGGER_S = 2.6;
const CYCLE_S = 22;

export default function AnimatedChatDemo() {
  const { t } = useLanguage();
  const messages = t("studentNetwork.chat.messages");

  return (
    <div className="sn-chat-demo" aria-hidden="true">
      <header className="sn-chat-demo__header">
        <span className="sn-chat-demo__avatar sn-chat-demo__avatar--mentor">MP</span>
        <div className="sn-chat-demo__header-text">
          <strong>Maya Patel</strong>
          <span>{t("studentNetwork.chat.roleLine")}</span>
          <span className="sn-chat-demo__status">{t("studentNetwork.chat.status")}</span>
        </div>
        <span className="sn-chat-demo__zoom-btn">
          <Calendar strokeWidth={2} aria-hidden="true" />
          {t("studentNetwork.chat.scheduleZoom")}
        </span>
      </header>

      <div className="sn-chat-demo__thread">
        {CHAT_MESSAGES.map((msg, index) => (
          <div
            key={`${msg.name}-${index}`}
            className={`sn-chat-demo__row sn-chat-demo__row--${msg.from}`}
            style={{
              animationDuration: `${CYCLE_S}s`,
              animationDelay: `${index * STAGGER_S}s`
            }}
          >
            {msg.from === "maya" ? (
              <span className="sn-chat-demo__avatar sn-chat-demo__avatar--sm">{msg.initials}</span>
            ) : null}
            <div className={`sn-chat-demo__bubble sn-chat-demo__bubble--${msg.from}`}>{messages[index]}</div>
            {msg.from === "jordan" ? (
              <span className="sn-chat-demo__avatar sn-chat-demo__avatar--sm">{msg.initials}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
