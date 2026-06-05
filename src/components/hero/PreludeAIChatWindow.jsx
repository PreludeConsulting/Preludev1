import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { HERO_FLOATING_CHAT } from "../../data/heroMentorMatch.js";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

function TypingDots() {
  return (
    <span className="hero-mm-chat__typing" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function PreludeAIChatWindow({ onClose, onStartMatch, reducedMotion }) {
  const [phase, setPhase] = useState("intro");
  const [picked, setPicked] = useState("");

  return (
    <motion.div
      className="hero-mm-chat"
      id="hero-prelude-chat-panel"
      role="dialog"
      aria-label="Prelude AI chat"
      initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
    >
      <header className="hero-mm-chat__header">
        <PreludePigAvatar size="xs" reducedMotion={reducedMotion} />
        <div>
          <p className="hero-mm-chat__title">Prelude AI</p>
          <p className="hero-mm-chat__sub">
            <span className="hero-mm-online" aria-hidden="true" />
            Your college-planning guide
          </p>
        </div>
        <button type="button" className="hero-mm-icon-btn" onClick={onClose} aria-label="Close chat">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="hero-mm-chat__body">
        <div className="hero-mm-chat__bubble hero-mm-chat__bubble--user">
          <p>{HERO_FLOATING_CHAT.userMessage}</p>
        </div>
        <div className="hero-mm-chat__bubble hero-mm-chat__bubble--ai">
          {phase === "typing" ? <TypingDots /> : <p>{phase === "intro" ? HERO_FLOATING_CHAT.aiReply : HERO_FLOATING_CHAT.followUps[picked]}</p>}
        </div>

        {phase === "intro" ? (
          <div className="hero-mm-chat__suggestions">
            {HERO_FLOATING_CHAT.suggestions.map((label) => (
              <button
                key={label}
                type="button"
                className="hero-mm-chip hero-mm-chip--compact"
                onClick={() => {
                  setPicked(label);
                  setPhase("typing");
                  setTimeout(() => setPhase("followup"), reducedMotion ? 200 : 700);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {phase === "followup" ? (
          <button type="button" className="hero-mm-btn hero-mm-btn--primary hero-mm-btn--sm hero-mm-chat__cta" onClick={onStartMatch}>
            Find mentors who fit my goals
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
