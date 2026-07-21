import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Calendar } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { usePreludeMotion } from "../../context/MotionContext.jsx";
import { useViewportActivity } from "../../lib/motion/useViewportActivity.js";

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

const STAGGER_MS = 1200;
const HOLD_MS = 1200;
const RESET_MS = 280;
const FADE_S = 0.42;

export default function AnimatedChatDemo() {
  const { t } = useLanguage();
  const messages = t("studentNetwork.chat.messages");
  const reduceMotion = usePreludeMotion().reducedMotion;
  const rootRef = useRef(null);
  const { active } = useViewportActivity(rootRef, { rootMargin: "120px 0px" });
  const [visibleCount, setVisibleCount] = useState(reduceMotion ? CHAT_MESSAGES.length : 0);

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(CHAT_MESSAGES.length);
      return undefined;
    }

    if (!active) return undefined;

    const complete = visibleCount >= CHAT_MESSAGES.length;
    const timeoutId = window.setTimeout(
      () => setVisibleCount((count) => (count >= CHAT_MESSAGES.length ? 0 : count + 1)),
      complete ? HOLD_MS + RESET_MS : STAGGER_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [active, reduceMotion, visibleCount]);

  return (
    <div ref={rootRef} className="sn-chat-demo" aria-hidden="true" data-motion-active={active ? "true" : "false"}>
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
          <motion.div
            key={`${msg.name}-${index}`}
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
            <div className={`sn-chat-demo__bubble sn-chat-demo__bubble--${msg.from}`}>{messages[index]}</div>
            {msg.from === "jordan" ? (
              <span className="sn-chat-demo__avatar sn-chat-demo__avatar--sm">{msg.initials}</span>
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
