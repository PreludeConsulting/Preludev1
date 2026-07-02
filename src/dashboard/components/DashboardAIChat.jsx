import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import { getAgentReply, getTypingDelay } from "../../lib/preludeAgent.js";
import FormattedChatText from "../../components/FormattedChatText.jsx";
import DashboardRecommendationCards from "./DashboardRecommendationCards.jsx";
import { PrimaryButton } from "./ui/index.jsx";

const SUGGESTED_PROMPTS = [
  { label: "Build my college list", prompt: "Build a reach/target/likely college list using my GPA, SAT, budget, and major." },
  { label: "Find scholarships", prompt: "What scholarships fit my profile from the Prelude database?" },
  { label: "Suggest summer programs", prompt: "What summer programs should I apply to based on my interests and goals?" },
  { label: "Improve my activities", prompt: "How can I improve my extracurricular profile with practical next steps?" },
  { label: "Recommend CS projects", prompt: "What CS project should I build for college apps based on my skill level?" },
  { label: "Analyze my SAT/ACT", prompt: "Is my SAT or ACT score on track based on the 2025 profile reports?" },
  { label: "Help with essays", prompt: "Help me brainstorm my Common App essay with structure and next steps." },
  { label: "Plan my application timeline", prompt: "What should I do this month for college applications based on my grade level?" },
  { label: "Compare colleges", prompt: "Compare two colleges using Prelude data and help me think about fit." },
  { label: "Find a mentor", prompt: "How does Prelude mentor matching work and who should I match with?" },
  { label: "What should I do next?", prompt: "I'm overwhelmed — give me a short prioritized checklist for this week." }
];

const WELCOME = {
  id: "welcome",
  role: "assistant",
  text: "Hi — I'm Prelude AI. I use Prelude's college, scholarship, program, activity, and CS project databases plus SAT/ACT reports to give personalized admissions guidance.",
  createdAt: Date.now(),
  isWelcome: true
};

function buildChatProfile(profile, user) {
  return {
    ...profile,
    name: user?.name,
    email: user?.email,
    majors: profile?.majors ?? profile?.targetMajors ?? [],
    savedColleges: profile?.savedColleges ?? profile?.colleges ?? []
  };
}

export default function DashboardAIChat({ initialPrompt = "" }) {
  const { user } = useAuth();
  const { profile } = useDashboardData();
  const [messages, setMessages] = useState([WELCOME]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);
  const sentInitial = useRef(false);
  const chatProfile = buildChatProfile(profile, user);

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
      const reply = await getAgentReply(trimmed, history, chatProfile);
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
      <div className="dash-ai-chat__chips" role="list">
        {SUGGESTED_PROMPTS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="dash-ai-chat__chip"
            onClick={() => sendText(chip.prompt)}
            disabled={thinking}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      <div className="dash-ai-chat__messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.role === "user" ? "dash-ai-chat__bubble dash-ai-chat__bubble--user" : "dash-ai-chat__bubble dash-ai-chat__bubble--ai"}
          >
            {msg.role === "assistant" ? <Sparkles className="h-4 w-4 dash-ai-chat__icon" aria-hidden="true" /> : null}
            <FormattedChatText text={msg.text} />
            {msg.role === "assistant" ? <DashboardRecommendationCards records={msg.retrievedRecords} /> : null}
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
