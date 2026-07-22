import { ArrowLeft, Compass, ExternalLink, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createGuidedAssistantSnapshot,
  getGuidedAssistantView,
  transitionGuidedAssistant
} from "../lib/guidedAssistantMachine.js";
import { navigateChatHref } from "../lib/chatLinkSecurity.js";
import { cn } from "../lib/utils.js";

export default function GuidedAssistant({ className, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(createGuidedAssistantSnapshot);
  const [isThinking, setIsThinking] = useState(false);
  const timeoutRef = useRef(null);
  const view = getGuidedAssistantView(snapshot);
  const navigateAction =
    onNavigate ||
    ((href) => navigateChatHref(href, { navigate, pathname: location.pathname }));

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  function dispatch(event) {
    if (isThinking) return;
    if (event.type === "MAIN_MENU") {
      setSnapshot(transitionGuidedAssistant(snapshot, event));
      return;
    }
    setIsThinking(true);
    const next = transitionGuidedAssistant(snapshot, event);
    timeoutRef.current = window.setTimeout(() => {
      if (next.action?.type === "navigate" || next.action?.type === "external") {
        navigateAction(next.action.href);
      } else {
        setSnapshot(next);
      }
      setIsThinking(false);
    }, 1000);
  }

  return (
    <div className={cn("guided-assistant", className)}>
      <div className="guided-assistant__nav" aria-label="Assistant navigation">
        <button type="button" onClick={() => dispatch({ type: "BACK" })} disabled={isThinking || !snapshot.history.length}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <button type="button" onClick={() => dispatch({ type: "MAIN_MENU" })} disabled={isThinking}>
          <Compass className="h-3.5 w-3.5" /> Main Menu
        </button>
        <button type="button" onClick={() => dispatch({ type: "FIND_MENTOR" })} disabled={isThinking}>
          <Users className="h-3.5 w-3.5" /> Find a Mentor
        </button>
      </div>

      <div className="guided-assistant__content" aria-live="polite">
        {view.fallback ? (
          <p className="guided-assistant__fallback">Sorry, I’m not sure which area you need help with. Choose one below.</p>
        ) : null}
        <div className="guided-assistant__message">{view.message}</div>
        <div className="guided-assistant__choices" role="group" aria-label="Available choices">
          {view.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={cn(choice.action?.type === "external" && "guided-assistant__resource")}
              disabled={isThinking}
              onClick={() => dispatch({ type: "CHOOSE", choiceId: choice.id })}
            >
              {choice.label}
              {choice.action?.type === "external" ? <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
        {isThinking ? (
          <div className="guided-assistant__thinking" role="status">
            <span className="sr-only">Prelude Guide is thinking</span>
            <span className="prelude-typing-dot" />
            <span className="prelude-typing-dot prelude-typing-dot--delay" />
            <span className="prelude-typing-dot prelude-typing-dot--delay-2" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
