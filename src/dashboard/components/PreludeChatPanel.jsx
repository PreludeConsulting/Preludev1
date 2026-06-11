import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Bot, Paperclip, Send, Sparkles } from "lucide-react";
import { STUDENT_AI_PROMPTS } from "../data/placeholders.js";
import { EmptyState, IconButton, PrimaryButton } from "./ui/index.jsx";

const DEFAULT_GREETING = {
  role: "assistant",
  text: "Hi! I can help you navigate deadlines, your college list, and mentor prep. What would you like to work on?"
};

export default function PreludeChatPanel({ prompts = STUDENT_AI_PROMPTS }) {
  const location = useLocation();
  const [messages, setMessages] = useState([DEFAULT_GREETING]);
  const [input, setInput] = useState(location.state?.prompt || "");
  const [activeConvo, setActiveConvo] = useState("today");

  function send(text) {
    const q = text || input;
    if (!q.trim()) return;
    const reply = q.includes("deadline")
      ? "You have 4 upcoming deadlines. Focus on your essay draft and UC application. Open your Calendar for details."
      : q.includes("task")
        ? "You have open tasks in Application Workspace → Tasks."
        : q.includes("mentor")
          ? "Discuss essay paragraph 2 and your reach school list. Visit My Mentor to schedule."
          : q.includes("college")
            ? "Review your college list tiers in Application Workspace → College List."
            : q.includes("essay")
              ? "Share your outline in the essay editor and I can suggest structure improvements."
              : "Ask about deadlines, tasks, mentor prep, or your college list — I will point you to the right page.";
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: reply }]);
    setInput("");
  }

  const hasMessages = messages.length > 1;

  return (
    <div className="dash-ai-layout">
      <aside className="dash-ai-layout__sidebar">
        <button type="button" className="dash-ai-convo dash-ai-convo--active" onClick={() => setActiveConvo("today")}>
          <Sparkles className="h-4 w-4" />
          <span>Today&apos;s session</span>
        </button>
        <button type="button" className="dash-ai-convo" onClick={() => setActiveConvo("essay")}>
          Essay feedback
        </button>
        <button type="button" className="dash-ai-convo" onClick={() => setActiveConvo("college")}>
          College list review
        </button>
      </aside>

      <div className="dash-ai-layout__main">
        <div className="dash-ai-layout__messages">
          {!hasMessages ? (
            <EmptyState
              icon={Bot}
              title="Ask Prelude AI anything"
              description="Get help with deadlines, essays, college lists, and mentor meetings."
            />
          ) : null}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "dash-bubble dash-bubble--me" : "dash-bubble dash-bubble--them"}>
              {m.text.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, j) => {
                const link = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
                if (link) return <Link key={j} to={link[2]}>{link[1]}</Link>;
                return <span key={j}>{part}</span>;
              })}
            </div>
          ))}
        </div>

        {!hasMessages ? (
          <div className="dash-ai-prompts">
            {prompts.map((p) => (
              <button key={p} type="button" className="dash-prompt-card" onClick={() => send(p)}>
                <Sparkles className="h-4 w-4" />
                <span>{p}</span>
              </button>
            ))}
          </div>
        ) : null}

        <form className="dash-ai-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <IconButton label="Attach file" type="button">
            <Paperclip className="h-4 w-4" />
          </IconButton>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Prelude AI…" />
          <PrimaryButton type="submit" className="dash-btn--icon">
            <Send className="h-4 w-4" />
            Send
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
