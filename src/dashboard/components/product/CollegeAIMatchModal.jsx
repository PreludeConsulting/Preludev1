import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, Sparkles } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { getCollegeRecommendations } from "../../../lib/auth.js";
import {
  FILTER_OPTION_SETS,
  formatAcceptance,
  formatTuition,
  matchCollegesWithProfile
} from "../../data/collegeExploreData.js";
import { Modal, PrimaryButton, SecondaryButton } from "../ui/index.jsx";
import SaveCollegeButton from "./SaveCollegeButton.jsx";

const STEPS = [
  {
    id: "major",
    title: "What do you want to study?",
    subtitle: "Prelude uses this to prioritize strong academic programs.",
    options: FILTER_OPTION_SETS.majors
  },
  {
    id: "location",
    title: "Where would you like to study?",
    subtitle: "Choose every region that fits your preferences.",
    options: FILTER_OPTION_SETS.location,
    multiple: true
  },
  {
    id: "setting",
    title: "What kind of place would you want to stay in?",
    subtitle: "Pick the campus setting that feels best.",
    options: [
      { id: "big-city", label: "Big city" },
      { id: "small-city", label: "Small city" },
      { id: "suburban", label: "Suburban" },
      { id: "college-town", label: "College town" },
      { id: "no-preference", label: "No preference" }
    ]
  },
  {
    id: "type",
    title: "Public or private?",
    subtitle: "Both can be great fits — this helps narrow recommendations.",
    options: [
      { id: "both", label: "Both public and private" },
      ...FILTER_OPTION_SETS.type
    ]
  },
  {
    id: "size",
    title: "What campus size feels right?",
    subtitle: "Think about class sizes and community feel.",
    options: [
      { id: "any", label: "No preference" },
      ...FILTER_OPTION_SETS.enrollment
    ]
  },
  {
    id: "budget",
    title: "What are your budget ranges?",
    subtitle: "Choose every range that works for you. Prelude weighs affordability alongside fit.",
    options: FILTER_OPTION_SETS.affordability,
    multiple: true
  },
  {
    id: "gpa",
    title: "What GPA do you have right now?",
    subtitle: "Choose your current unweighted GPA range on a 4.0 scale.",
    input: "gpa"
  },
  {
    id: "testScores",
    title: "Optional: enter an SAT or ACT score",
    subtitle: "Skip this if you are test-optional, unsure, or have not tested yet.",
    input: "testScores",
    optional: true
  },
  {
    id: "matchPreference",
    title: "What kind of schools should we prioritize?",
    subtitle: "Balance reach, target, and safety schools in your list.",
    options: FILTER_OPTION_SETS.matchPreference
  }
];

const GPA_RANGES = [
  { value: "2.25", label: "Below 2.5" },
  { value: "2.75", label: "2.5-2.99" },
  { value: "3.25", label: "3.0-3.49" },
  { value: "3.65", label: "3.5-3.79" },
  { value: "3.9", label: "3.8-4.0" }
];

export default function CollegeAIMatchModal({ open, onClose, onSaveCollege, savedIds }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("saved");
  const [recommendations, setRecommendations] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState("");
  const [questionnaireRequired, setQuestionnaireRequired] = useState(false);
  const [preferences, setPreferences] = useState(null);

  const step = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + (phase === "results" ? 1 : 0)) / STEPS.length) * 100);
  const currentAnswer = answers[step.id];
  const hasCurrentAnswer = step.optional || (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : Boolean(currentAnswer));

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  function reset() {
    setStepIndex(0);
    setAnswers({});
    setPhase("saved");
    setRecommendations([]);
    setSavedError("");
    setQuestionnaireRequired(false);
    setPreferences(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectOption(optionId) {
    setAnswers((prev) => {
      if (!step.multiple) return { ...prev, [step.id]: optionId };
      const current = Array.isArray(prev[step.id]) ? prev[step.id] : [];
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [step.id]: next };
    });
  }

  function updateAnswer(field, value) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function updateBoundedScore(field, value, max) {
    if (value === "") return updateAnswer(field, "");
    const score = Number(value);
    updateAnswer(field, Number.isFinite(score) && score > max ? String(max) : value);
  }

  function handleNext() {
    if (!hasCurrentAnswer) return;
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

  function skipOptionalStep() {
    if (!step.optional) return;
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSavedLoading(true);
    setSavedError("");
    getCollegeRecommendations()
      .then((data) => {
        if (cancelled) return;
        setRecommendations(data.recommendations || []);
        setQuestionnaireRequired(Boolean(data.questionnaireRequired));
        setPreferences(data.preferences || null);
        setPhase("saved");
      })
      .catch((err) => {
        if (!cancelled) {
          setSavedError(err.message || "Could not load questionnaire-based recommendations.");
          setPhase("questions");
        }
      })
      .finally(() => {
        if (!cancelled) setSavedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function formatDatasetMeta(school) {
    const parts = [`${school.city || "City TBD"}, ${school.state || "State TBD"}`];
    if (school.admissionRate != null) parts.push(formatAcceptance(Math.round(school.admissionRate * 100)));
    if (school.averageNetPrice != null) parts.push(`$${Math.round(school.averageNetPrice).toLocaleString()} avg net price`);
    return parts.join(" · ");
  }

  function manualCollegeDescription(school) {
    const major = answers.major;
    const profileSignals = [
      answers.gpa ? `GPA ${GPA_RANGES.find((range) => range.value === answers.gpa)?.label || answers.gpa}` : "",
      answers.sat ? `SAT ${answers.sat}` : "",
      answers.act ? `ACT ${answers.act}` : "",
      answers.setting && answers.setting !== "no-preference" ? answers.setting.replace("-", " ") : ""
    ].filter(Boolean);
    if (/Massachusetts Institute of Technology|MIT/i.test(school.name) && /aerospace|engineering/i.test(major || "")) {
      return "MIT is worth reviewing because its engineering ecosystem is one of the strongest in the world, including aerospace-adjacent research and project opportunities.";
    }
    const majorLabel = school.majors?.find((item) => item.toLowerCase().includes(String(major || "").toLowerCase())) || school.majors?.[0];
    if (majorLabel) {
      return `${school.shortName || school.name} may fit because it offers academic paths related to ${majorLabel} and matches the preferences you selected${profileSignals.length ? `, including ${profileSignals.join(", ")}` : ""}.`;
    }
    return `${school.shortName || school.name} may fit your selected location, campus, affordability, and admissions preferences.`;
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Prelude college matching"
      scrollable
      footer={
        phase === "saved" ? (
          <>
            <SecondaryButton type="button" onClick={() => setPhase("questions")}>Refine manually</SecondaryButton>
            <PrimaryButton type="button" onClick={handleClose}>Done</PrimaryButton>
          </>
        ) : phase === "results" ? (
          <>
            <SecondaryButton type="button" onClick={handleBack}>Back</SecondaryButton>
            <PrimaryButton type="button" onClick={handleClose}>Done</PrimaryButton>
          </>
        ) : phase === "thinking" ? null : (
          <>
            <SecondaryButton type="button" onClick={stepIndex === 0 ? handleClose : handleBack} disabled={phase === "thinking"}>
              {stepIndex === 0 ? "Cancel" : "Back"}
            </SecondaryButton>
            {step.optional ? (
              <SecondaryButton type="button" onClick={skipOptionalStep} disabled={phase === "thinking"}>
                Skip
              </SecondaryButton>
            ) : null}
            <PrimaryButton type="button" onClick={handleNext} disabled={!hasCurrentAnswer || phase === "thinking"}>
              {stepIndex === STEPS.length - 1 ? "Match with Prelude" : "Continue"}
            </PrimaryButton>
          </>
        )
      }
    >
      <div className="dash-college-ai-modal">
        <div className="dash-college-ai-modal__hero">
          <span className="dash-college-ai-modal__icon" aria-hidden="true">
            <Search className="h-5 w-5" />
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="dash-college-ai-modal__eyebrow">Prelude Match</p>
            <p className="dash-college-ai-modal__lead">
              Prelude recommends colleges from your saved questionnaire and profile. You can refine the match manually too.
            </p>
          </div>
        </div>

        <div className="dash-college-ai-modal__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        {savedLoading ? (
          <div className="dash-college-ai-modal__thinking">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <p>Prelude is reading your questionnaire and ranking colleges…</p>
          </div>
        ) : null}

        {phase === "thinking" ? (
          <div className="dash-college-ai-modal__thinking">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <p>Prelude is analyzing your preferences…</p>
          </div>
        ) : null}

        {phase === "saved" && !savedLoading ? (
          <div className="dash-college-ai-modal__results">
            <h3 className="dash-college-ai-modal__question">Recommended from your questionnaire</h3>
            <p className="dash-college-ai-modal__subtitle">
              {questionnaireRequired
                ? "Complete the PreludeMatch questionnaire for stronger personalization. These are starting recommendations from your profile and available college data."
                : "These schools are ranked from your saved PreludeMatch questionnaire, student profile, and verified college data."}
            </p>
            {preferences?.major ? (
              <p className="dash-college-ai-modal__subtitle">Academic focus: {preferences.major}</p>
            ) : null}
            {recommendations.length ? (
              <p className="dash-college-ai-modal__scroll-hint">Showing {recommendations.length} recommendations. Scroll to review the full list.</p>
            ) : null}
            {savedError ? <p className="dash-callout dash-callout--danger">{savedError}</p> : null}
            <ul className="dash-college-ai-modal__result-list">
              {recommendations.map((school) => (
                <li key={school.unitid || school.id} className="dash-college-ai-modal__result dash-college-ai-modal__result--ranked">
                  <div>
                    <p className="dash-college-ai-modal__result-name">
                      {school.name}
                      {school.score != null ? <span> {school.score}% fit</span> : null}
                    </p>
                    {school.description ? <p className="dash-college-ai-modal__description">{school.description}</p> : null}
                    <p className="dash-college-ai-modal__result-meta">{formatDatasetMeta(school)}</p>
                    {school.matchCategory ? <p className="dash-college-ai-modal__result-meta">Category: {school.matchCategory}</p> : null}
                    {school.reasons?.length ? (
                      <ul className="dash-college-ai-modal__reasons">
                        {school.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {school.website ? (
                    <a
                      href={school.website.startsWith("http") ? school.website : `https://${school.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dash-btn dash-btn--secondary dash-btn--sm"
                    >
                      Visit <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {!recommendations.length ? (
              <p className="dash-colleges-empty-hint">No recommendations are available yet. Try the manual refinement flow.</p>
            ) : null}
          </div>
        ) : null}

        {phase === "questions" ? (
          <div className="dash-college-ai-modal__step">
            <h3 className="dash-college-ai-modal__question">{step.title}</h3>
            <p className="dash-college-ai-modal__subtitle">{step.subtitle}</p>
            {step.input === "gpa" ? (
              <label className="dash-college-ai-modal__text-field">
                <span>Current unweighted GPA range</span>
                <select
                  value={answers.gpa || ""}
                  onChange={(event) => updateAnswer("gpa", event.target.value)}
                >
                  <option value="" disabled>Select a GPA range</option>
                  {GPA_RANGES.map((range) => (
                    <option key={range.value} value={range.value}>{range.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {step.input === "testScores" ? (
              <div className="dash-college-ai-modal__score-grid">
                <label className="dash-college-ai-modal__text-field">
                  <span>SAT score</span>
                  <input
                    type="number"
                    min="400"
                    max="1600"
                    step="10"
                    value={answers.sat || ""}
                    onChange={(event) => updateBoundedScore("sat", event.target.value, 1600)}
                    placeholder="Example: 1380"
                  />
                </label>
                <label className="dash-college-ai-modal__text-field">
                  <span>ACT score</span>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    step="1"
                    value={answers.act || ""}
                    onChange={(event) => updateBoundedScore("act", event.target.value, 36)}
                    placeholder="Example: 31"
                  />
                </label>
              </div>
            ) : null}
            {step.options?.length ? (
              <div className="dash-college-ai-modal__options" role="listbox" aria-label={step.title}>
                {step.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={step.multiple ? Array.isArray(answers[step.id]) && answers[step.id].includes(option.id) : answers[step.id] === option.id}
                    className={cn(
                      "dash-college-ai-modal__option",
                      (step.multiple ? Array.isArray(answers[step.id]) && answers[step.id].includes(option.id) : answers[step.id] === option.id) && "dash-college-ai-modal__option--active"
                    )}
                    onClick={() => selectOption(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "results" ? (
          <div className="dash-college-ai-modal__results">
            <h3 className="dash-college-ai-modal__question">Your Prelude recommendations</h3>
            <p className="dash-college-ai-modal__subtitle">
              Based on your answers, these schools are strong fits. Save any you want on your list.
            </p>
            {recommendations.length ? (
              <p className="dash-college-ai-modal__scroll-hint">Showing {recommendations.length} recommendations. Scroll to review the full list.</p>
            ) : null}
            <ul className="dash-college-ai-modal__result-list">
              {recommendations.map((school) => {
                const saved = savedSet.has(school.id);
                return (
                  <li key={school.id} className="dash-college-ai-modal__result">
                    <div>
                      <p className="dash-college-ai-modal__result-name">{school.name}</p>
                      <p className="dash-college-ai-modal__description">{manualCollegeDescription(school)}</p>
                      <p className="dash-college-ai-modal__result-meta">
                        {school.location} · {formatAcceptance(school.acceptanceRate)} · {formatTuition(school.tuition)}
                      </p>
                    </div>
                    <SaveCollegeButton
                      collegeId={school.id}
                      saved={saved}
                      onToggle={async (id, currentlySaved) => onSaveCollege(id, currentlySaved)}
                      size="sm"
                      label="Save"
                      savedLabel="Saved"
                    />
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
