import { Calendar } from "lucide-react";

const CHAT_MESSAGES = [
  {
    from: "jordan",
    name: "Jordan",
    initials: "JL",
    text: "Hey Maya, I keep rewriting my personal statement and now I have no idea if it's actually getting better."
  },
  {
    from: "maya",
    name: "Maya",
    initials: "MP",
    text: "Haha, you're good~ I think you've just been looking at it for too long."
  },
  {
    from: "maya",
    name: "Maya",
    initials: "MP",
    text: "Tell you what, instead of going back and forth over messages, let's hop on a quick Zoom call sometime this week. I think it'd be way easier to talk through your story together and figure out what's not clicking."
  },
  {
    from: "jordan",
    name: "Jordan",
    initials: "JL",
    text: "That would help so much! I've been stressing about this for weeks 🥲"
  },
  {
    from: "maya",
    name: "Maya",
    initials: "MP",
    text: "Don't worry, we'll get it sorted out. I'll send over a few times that work for me and we'll figure it out together."
  }
];

const STAGGER_S = 2.6;
const CYCLE_S = 22;

export default function AnimatedChatDemo() {
  return (
    <div className="sn-chat-demo" aria-hidden="true">
      <header className="sn-chat-demo__header">
        <span className="sn-chat-demo__avatar sn-chat-demo__avatar--mentor">MP</span>
        <div className="sn-chat-demo__header-text">
          <strong>Maya Patel</strong>
          <span>Mentor · Georgia Tech · CS</span>
          <span className="sn-chat-demo__status">Online</span>
        </div>
        <span className="sn-chat-demo__zoom-btn">
          <Calendar strokeWidth={2} aria-hidden="true" />
          Schedule Zoom
        </span>
      </header>

      <div className="sn-chat-demo__thread">
        {CHAT_MESSAGES.map((msg, index) => (
          <div
            key={msg.text}
            className={`sn-chat-demo__row sn-chat-demo__row--${msg.from}`}
            style={{
              animationDuration: `${CYCLE_S}s`,
              animationDelay: `${index * STAGGER_S}s`
            }}
          >
            {msg.from === "maya" ? (
              <span className="sn-chat-demo__avatar sn-chat-demo__avatar--sm">{msg.initials}</span>
            ) : null}
            <div className={`sn-chat-demo__bubble sn-chat-demo__bubble--${msg.from}`}>{msg.text}</div>
            {msg.from === "jordan" ? (
              <span className="sn-chat-demo__avatar sn-chat-demo__avatar--sm">{msg.initials}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
