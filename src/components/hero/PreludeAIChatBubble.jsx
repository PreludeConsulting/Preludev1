import { AnimatePresence } from "motion/react";
import { motion } from "motion/react";
import PreludePigAvatar from "./PreludePigAvatar.jsx";
import PreludeAIChatWindow from "./PreludeAIChatWindow.jsx";

export default function PreludeAIChatBubble({ open, onToggle, onStartMatch, reducedMotion }) {
  return (
    <div className="hero-mm-float">
      <AnimatePresence>
        {open ? (
          <PreludeAIChatWindow
            key="window"
            onClose={() => onToggle(false)}
            onStartMatch={() => {
              onToggle(false);
              onStartMatch?.();
            }}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </AnimatePresence>

      {!open ? (
        <motion.button
          type="button"
          className="hero-mm-float__pill"
          onClick={() => onToggle(true)}
          aria-expanded={open}
          aria-controls="hero-prelude-chat-panel"
          animate={reducedMotion ? undefined : { scale: [1, 1.02, 1] }}
          transition={{ duration: 2.8, repeat: Infinity }}
          whileHover={reducedMotion ? undefined : { y: -2 }}
        >
          <PreludePigAvatar size="xs" reducedMotion={reducedMotion} label="" />
          <span>Need help? Ask Prelude AI</span>
        </motion.button>
      ) : null}
    </div>
  );
}
