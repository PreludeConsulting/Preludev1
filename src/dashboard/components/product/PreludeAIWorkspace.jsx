import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Bot, Sparkles } from "lucide-react";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { parseGradeNumber } from "../../config/studentDashboardByGrade.js";

const SUGGESTION_CHIPS = [
  {
    label: "Build a stronger CS profile",
    prompt: "How can I build a stronger computer science profile for college admissions?"
  },
  {
    label: "Find summer programs",
    prompt: "What summer programs would strengthen my college application?"
  },
  {
    label: "Improve leadership experience",
    prompt: "How can I improve my leadership experience before applying to college?"
  },
  {
    label: "Prepare for SAT",
    prompt: "What is the best SAT prep plan for an 11th grader?"
  },
  {
    label: "Recommend AP courses",
    prompt: "Which AP courses should I take next year based on my goals?"
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
            {SUGGESTION_CHIPS.slice(0, 3).map((chip) => (
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
