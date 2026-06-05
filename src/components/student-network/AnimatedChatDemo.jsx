import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
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

const STAGGER_MS = 1200;
const HOLD_MS = 1200;
const RESET_MS = 280;
const FADE_S = 0.42;

export default function AnimatedChatDemo() {
  const reduceMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(reduceMotion ? CHAT_MESSAGES.length : 0);

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(CHAT_MESSAGES.length);
      return undefined;
    }

    let cancelled = false;
    const timeouts = [];

    const schedule = (fn, delay) => {
      const id = window.setTimeout(() => {
        if (!cancelled) {
          fn();
        }
      }, delay);
      timeouts.push(id);
    };

    const runCycle = () => {
      setVisibleCount(0);
      let elapsed = RESET_MS;

      CHAT_MESSAGES.forEach((_, index) => {
        schedule(() => setVisibleCount(index + 1), elapsed);
        elapsed += STAGGER_MS;
      });

      schedule(() => {
        setVisibleCount(0);
        schedule(runCycle, RESET_MS);
      }, elapsed + HOLD_MS);
    };

    runCycle();

    return () => {
      cancelled = true;
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [reduceMotion]);

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
          <motion.div
            key={msg.text}
            className={`sn-chat-demo__row sn-chat-demo__row--${msg.from}`}
            initial={false}
            animate={{
              opacity: index < visibleCount ? 1 : 0,
              y: index < visibleCount ? 0 : 12
            }}
            transition={{ duration: reduceMotion ? 0 : FADE_S, ease: "easeOut" }}
          >
            {msg.from === "maya" ? (
              <span className="sn-chat-demo__avatar sn-chat-demo__avatar--sm">{msg.initials}</span>
            ) : null}
            <div className={`sn-chat-demo__bubble sn-chat-demo__bubble--${msg.from}`}>{msg.text}</div>
            {msg.from === "jordan" ? (
              <span className="sn-chat-demo__avatar sn-chat-demo__avatar--sm">{msg.initials}</span>
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
