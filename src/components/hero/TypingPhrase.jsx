import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import { useViewportActivity } from "../../lib/motion/useViewportActivity.js";

const TYPE_DELAY = 125;
const DELETE_DELAY = 80;
const COMPLETE_PAUSE = 2000;
const BETWEEN_PHRASES_PAUSE = 500;

export default function TypingPhrase({ phrases = [], staticPhrase, className = "" }) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef(null);
  const { active } = useViewportActivity(rootRef);
  const safePhrases = useMemo(() => phrases.filter(Boolean), [phrases]);
  const fallback = staticPhrase || safePhrases[0] || "";
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const reservedCharacters = Math.max(fallback.length, ...safePhrases.map((phrase) => phrase.length), 1);

  useEffect(() => {
    if (reducedMotion || !active || safePhrases.length === 0) return undefined;

    const phrase = safePhrases[phraseIndex % safePhrases.length];
    let delay = deleting ? DELETE_DELAY : TYPE_DELAY;
    let nextStep;

    if (!deleting && text === phrase) {
      delay = COMPLETE_PAUSE;
      nextStep = () => setDeleting(true);
    } else if (deleting && text.length === 0) {
      delay = BETWEEN_PHRASES_PAUSE;
      nextStep = () => {
        setDeleting(false);
        setPhraseIndex((index) => (index + 1) % safePhrases.length);
      };
    } else if (deleting) {
      nextStep = () => setText((current) => current.slice(0, -1));
    } else {
      nextStep = () => setText(phrase.slice(0, text.length + 1));
    }

    const timeoutId = window.setTimeout(nextStep, delay);
    return () => window.clearTimeout(timeoutId);
  }, [active, deleting, phraseIndex, reducedMotion, safePhrases, text]);

  return (
    <span
      ref={rootRef}
      className={`typing-phrase ${className}`.trim()}
      data-motion-active={active ? "true" : "false"}
      style={{ "--typing-reserved-chars": reservedCharacters }}
    >
      <span className="sr-only">{fallback}</span>
      <span className="typing-phrase__visual" aria-hidden="true">
        {reducedMotion ? fallback : text}
        {!reducedMotion ? <span className="typing-phrase__cursor" /> : null}
      </span>
    </span>
  );
}
