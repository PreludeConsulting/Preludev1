import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import { getAgentReply, getTypingDelay } from "../../lib/preludeAgent.js";
import FormattedChatText from "../../components/FormattedChatText.jsx";
import { PrimaryButton } from "./ui/index.jsx";

const WELCOME = {
  id: "welcome",
  role: "assistant",
  text: "Hi — I'm Prelude AI. Ask about college lists, essays, SAT prep, extracurriculars, scholarships, or your application timeline.",
  createdAt: Date.now(),
  isWelcome: true
};

export default function DashboardAIChat({ initialPrompt = "" }) {
  const { user } = useAuth();
  const { profile } = useDashboardData();
  const [messages, setMessages] = useState([WELCOME]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  async function sendText(text) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
      createdAt: Date.now()
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setDraft("");
    setThinking(true);

    try {
      const reply = await getAgentReply(trimmed, history, {
        ...profile,
        name: user?.name,
        email: user?.email
      });
      await new Promise((r) => setTimeout(r, getTypingDelay(reply.text || "")));
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: "I couldn't reach Prelude AI right now. Please try again in a moment.",
          createdAt: Date.now(),
          isError: true
        }
      ]);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      sendText(initialPrompt);
    }
  }, [initialPrompt]);

  function handleSubmit(e) {
    e.preventDefault();
    sendText(draft);
  }

  return (
    <div className="dash-ai-chat">
      <div className="dash-ai-chat__messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.role === "user" ? "dash-ai-chat__bubble dash-ai-chat__bubble--user" : "dash-ai-chat__bubble dash-ai-chat__bubble--ai"}
          >
            {msg.role === "assistant" ? <Sparkles className="h-4 w-4 dash-ai-chat__icon" aria-hidden="true" /> : null}
            <FormattedChatText text={msg.text} />
          </div>
        ))}
        {thinking ? (
          <div className="dash-ai-chat__bubble dash-ai-chat__bubble--ai dash-ai-chat__bubble--typing" role="status">
            <Bot className="h-4 w-4" aria-hidden="true" />
            <span className="dash-ai-chat__dots"><span /><span /><span /></span>
          </div>
        ) : null}
      </div>

      <form className="dash-ai-chat__composer" onSubmit={handleSubmit}>
        <textarea
          className="dash-ai-chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about admissions, essays, tests, activities, or scholarships…"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendText(draft);
            }
          }}
        />
        <PrimaryButton type="submit" className="dash-btn--sm" disabled={!draft.trim() || thinking}>
          <Send className="h-4 w-4" /> Send
        </PrimaryButton>
      </form>
    </div>
  );
}
