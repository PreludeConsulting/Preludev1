import { useMemo, useState } from "react";
import { Bot, Check, Sparkles } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import {
  FILTER_OPTION_SETS,
  formatAcceptance,
  formatTuition,
  matchCollegesWithProfile
} from "../../data/collegeExploreData.js";
import { Modal, PrimaryButton, SecondaryButton } from "../ui/index.jsx";

const STEPS = [
  {
    id: "major",
    title: "What do you want to study?",
    subtitle: "Prelude AI uses this to prioritize strong academic programs.",
    options: FILTER_OPTION_SETS.majors
  },
  {
    id: "location",
    title: "Where would you like to study?",
    subtitle: "Choose a region that fits your preferences.",
    options: FILTER_OPTION_SETS.location
  },
  {
    id: "type",
    title: "Public or private?",
    subtitle: "Both can be great fits — this helps narrow recommendations.",
    options: FILTER_OPTION_SETS.type
  },
  {
    id: "size",
    title: "What campus size feels right?",
    subtitle: "Think about class sizes and community feel.",
    options: FILTER_OPTION_SETS.enrollment
  },
  {
    id: "budget",
    title: "What is your budget range?",
    subtitle: "Prelude AI weighs affordability alongside fit.",
    options: FILTER_OPTION_SETS.affordability
  },
  {
    id: "matchPreference",
    title: "What kind of schools should we prioritize?",
    subtitle: "Balance reach, target, and safety schools in your list.",
    options: FILTER_OPTION_SETS.match
  }
];

export default function CollegeAIMatchModal({ open, onClose, onSaveCollege, savedIds }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("questions");
  const [recommendations, setRecommendations] = useState([]);

  const step = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + (phase === "results" ? 1 : 0)) / STEPS.length) * 100);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  function reset() {
    setStepIndex(0);
    setAnswers({});
    setPhase("questions");
    setRecommendations([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectOption(optionId) {
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
  }

  function handleNext() {
    if (!answers[step.id]) return;
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    setPhase("thinking");
    window.setTimeout(() => {
      setRecommendations(matchCollegesWithProfile(answers));
      setPhase("results");
    }, 900);
  }

  function handleBack() {
    if (phase === "results") {
      setPhase("questions");
      setStepIndex(STEPS.length - 1);
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Prelude AI college matching"
      footer={
        phase === "results" ? (
          <>
            <SecondaryButton type="button" onClick={handleBack}>Back</SecondaryButton>
            <PrimaryButton type="button" onClick={handleClose}>Done</PrimaryButton>
          </>
        ) : phase === "thinking" ? null : (
          <>
            <SecondaryButton type="button" onClick={stepIndex === 0 ? handleClose : handleBack} disabled={phase === "thinking"}>
              {stepIndex === 0 ? "Cancel" : "Back"}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={handleNext} disabled={!answers[step.id] || phase === "thinking"}>
              {stepIndex === STEPS.length - 1 ? "Match with Prelude AI" : "Continue"}
            </PrimaryButton>
          </>
        )
      }
    >
      <div className="dash-college-ai-modal">
        <div className="dash-college-ai-modal__hero">
          <span className="dash-college-ai-modal__icon" aria-hidden="true">
            <Bot className="h-5 w-5" />
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="dash-college-ai-modal__eyebrow">Prelude AI</p>
            <p className="dash-college-ai-modal__lead">
              Answer a few guided questions and Prelude AI will recommend colleges that fit your profile.
            </p>
          </div>
        </div>

        <div className="dash-college-ai-modal__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        {phase === "thinking" ? (
          <div className="dash-college-ai-modal__thinking">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <p>Prelude AI is analyzing your preferences…</p>
          </div>
        ) : null}

        {phase === "questions" ? (
          <div className="dash-college-ai-modal__step">
            <h3 className="dash-college-ai-modal__question">{step.title}</h3>
            <p className="dash-college-ai-modal__subtitle">{step.subtitle}</p>
            <div className="dash-college-ai-modal__options" role="listbox" aria-label={step.title}>
              {step.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={answers[step.id] === option.id}
                  className={cn(
                    "dash-college-ai-modal__option",
                    answers[step.id] === option.id && "dash-college-ai-modal__option--active"
                  )}
                  onClick={() => selectOption(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {phase === "results" ? (
          <div className="dash-college-ai-modal__results">
            <h3 className="dash-college-ai-modal__question">Your Prelude AI recommendations</h3>
            <p className="dash-college-ai-modal__subtitle">
              Based on your answers, these schools are strong fits. Save any you want on your list.
            </p>
            <ul className="dash-college-ai-modal__result-list">
              {recommendations.map((school) => {
                const saved = savedSet.has(school.id);
                return (
                  <li key={school.id} className="dash-college-ai-modal__result">
                    <div>
                      <p className="dash-college-ai-modal__result-name">{school.name}</p>
                      <p className="dash-college-ai-modal__result-meta">
                        {school.location} · {formatAcceptance(school.acceptanceRate)} · {formatTuition(school.tuition)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={cn("dash-college-save-btn dash-college-save-btn--sm", saved && "dash-college-save-btn--saved")}
                      onClick={() => onSaveCollege(school.id)}
                    >
                      {saved ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Saved
                        </>
                      ) : (
                        "Save"
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
