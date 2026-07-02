import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Bot, Sparkles } from "lucide-react";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { parseGradeNumber } from "../../config/studentDashboardByGrade.js";

const SUGGESTION_CHIPS = [
  {
    label: "Build my college list",
    prompt: "Build a reach/target/likely college list using my profile, budget, and major."
  },
  {
    label: "Find scholarships",
    prompt: "What scholarships fit me from the Prelude database?"
  },
  {
    label: "Suggest summer programs",
    prompt: "What summer programs should I apply to based on my interests and goals?"
  },
  {
    label: "Improve my activities",
    prompt: "How can I improve my extracurricular profile with practical next steps?"
  },
  {
    label: "Recommend CS projects",
    prompt: "What CS project should I build for college apps based on my skill level?"
  },
  {
    label: "Analyze my SAT/ACT",
    prompt: "Is my SAT or ACT score on track based on the 2025 profile reports?"
  },
  {
    label: "Help with essays",
    prompt: "Help me brainstorm my Common App essay with structure and next steps."
  },
  {
    label: "Plan my application timeline",
    prompt: "What should I do this month for college applications based on my grade level?"
  },
  {
    label: "Compare colleges",
    prompt: "Compare two colleges using Prelude data and help me think about fit."
  },
  {
    label: "Find a mentor",
    prompt: "How does Prelude mentor matching work and who should I match with?"
  },
  {
    label: "What should I do next?",
    prompt: "I'm overwhelmed — give me a short prioritized checklist for this week."
  }
];

function buildProfileContext(profile, studentProfileStats) {
  const gradeNum = parseGradeNumber(profile);
  const gradeLabel = gradeNum ? `Grade ${gradeNum}` : profile?.grade || "Grade 11";
  const major = profile?.majors?.[0] || "Undeclared";
  const gpa = studentProfileStats?.gpa ?? profile?.gpa ?? "—";

  return `${gradeLabel} • ${major} • GPA ${gpa}`;
}

export default function PreludeAIWorkspace({ profile, studentProfileStats }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const contextLabel = buildProfileContext(profile, studentProfileStats);
  const gradeNum = parseGradeNumber(profile);
  const gradeBadge = gradeNum ? `Grade ${gradeNum}` : "Grade 11";

  function applyPrompt(text) {
    setPrompt(text);
    inputRef.current?.focus();
  }

  function handleSend() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    navigate(`${STUDENT_DASHBOARD_BASE}/ai`, { state: { prompt: trimmed } });
  }

  function handleSubmit(e) {
    e.preventDefault();
    handleSend();
  }

  return (
    <div className="dash-prelude-ai">
      <div className="dash-prelude-ai__layout">
        <div className="dash-prelude-ai__left">
          <p className="dash-prelude-ai__lead">
            Based on your profile, here are some suggested questions.
          </p>
          <div className="dash-prelude-ai__chips" role="list">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="dash-prelude-ai__chip"
                onClick={() => applyPrompt(chip.prompt)}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dash-prelude-ai__right">
          <div className="dash-prelude-ai__context">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{contextLabel}</span>
          </div>

          <form className="dash-prelude-ai__composer" onSubmit={handleSubmit}>
            <label className="dash-prelude-ai__composer-label" htmlFor="prelude-ai-prompt">
              Ask Prelude AI
            </label>
            <textarea
              id="prelude-ai-prompt"
              ref={inputRef}
              className="dash-prelude-ai__composer-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about college admissions, extracurriculars, classes, leadership, SAT prep, scholarships, and more..."
              rows={4}
            />
            <div className="dash-prelude-ai__composer-footer">
              <span className="dash-prelude-ai__grade-badge">{gradeBadge}</span>
              <button
                type="submit"
                className="dash-prelude-ai__send"
                disabled={!prompt.trim()}
              >
                <span>Send</span>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
