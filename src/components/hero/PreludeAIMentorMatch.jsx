import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HERO_MATCH_QUESTIONS, HERO_PROFILE_PLACEHOLDERS } from "../../data/heroMentorMatch.js";
import { useReducedMotion, heroMotion } from "../../lib/useReducedMotion.js";
import AIQuestionPanel from "./AIQuestionPanel.jsx";
import DashboardSidebar from "./DashboardSidebar.jsx";
import DashboardTopBar from "./DashboardTopBar.jsx";
import MatchingAnimation from "./MatchingAnimation.jsx";
import MentorMatchResults from "./MentorMatchResults.jsx";
import PreludeAIChatBubble from "./PreludeAIChatBubble.jsx";
import StudentProfileSummary from "./StudentProfileSummary.jsx";

function buildProfile(answers) {
  const profile = { ...HERO_PROFILE_PLACEHOLDERS, grade: "11th grade" };

  if (answers.stage) profile.stage = answers.stage;
  if (answers.support) profile.concern = answers.support;
  if (answers.major) profile.major = answers.major;
  if (answers.mentorStyle) profile.mentorStyle = answers.mentorStyle;
  if (answers.priority) profile.priority = answers.priority;

  if (answers.schools?.length) {
    profile.schools =
      answers.schools.length === 1 ? answers.schools[0] : answers.schools.slice(0, 4).join(", ");
  }

  return profile;
}

export default function PreludeAIMentorMatch({ introReady = true }) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState("questionnaire");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [highlightedKey, setHighlightedKey] = useState(null);
  const [pigAnimate, setPigAnimate] = useState("idle");
  const [chatOpen, setChatOpen] = useState(false);

  const profile = useMemo(() => buildProfile(answers), [answers]);

  const flashProfile = useCallback(
    (questionId) => {
      const q = HERO_MATCH_QUESTIONS.find((item) => item.id === questionId);
      if (!q) return;
      const profileField = {
        stage: "stage",
        support: "concern",
        major: "major",
        mentorStyle: "mentorStyle",
        schools: "schools",
        priority: "priority"
      }[q.id];
      setHighlightedKey(profileField ?? null);
      setPigAnimate("bounce");
      const t = setTimeout(() => {
        setHighlightedKey(null);
        setPigAnimate("idle");
      }, reducedMotion ? 0 : 900);
      return () => clearTimeout(t);
    },
    [reducedMotion]
  );

  function handleAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    flashProfile(questionId);
  }

  function handleContinue() {
    if (stepIndex >= HERO_MATCH_QUESTIONS.length - 1) {
      setPhase("matching");
      return;
    }
    setStepIndex((s) => s + 1);
    setPigAnimate("bounce");
    setTimeout(() => setPigAnimate("idle"), reducedMotion ? 0 : 450);
  }

  function handleBack() {
    setStepIndex((s) => Math.max(0, s - 1));
  }

  function handleSkip() {
    handleContinue();
  }

  function handleRestart() {
    setPhase("questionnaire");
    setStepIndex(0);
    setAnswers({});
    setHighlightedKey(null);
    setChatOpen(false);
  }

  function handleStartFromChat() {
    setPhase("questionnaire");
    setStepIndex(0);
    setChatOpen(false);
    setPigAnimate("bounce");
  }

  return (
    <motion.div
      className="hero-mm"
      initial={false}
      animate={introReady ? heroMotion.cardFloat(reducedMotion) : undefined}
      aria-label="Prelude AI Mentor Match interactive demo"
    >
      <div className="hero-mm__glow" aria-hidden="true" />
      <div className="hero-mm__orbit hero-mm__orbit--one" aria-hidden="true" />
      <div className="hero-mm__orbit hero-mm__orbit--two" aria-hidden="true" />

      <div className="hero-mm__shell">
        <DashboardTopBar reducedMotion={reducedMotion} />

        <div className="hero-mm__body">
          <DashboardSidebar />
          <div className="hero-mm__mobile-nav">
            <DashboardSidebar compact />
          </div>

          <div className="hero-mm__content">
            <AnimatePresence mode="wait">
              {phase === "questionnaire" ? (
                <motion.div
                  key="questions"
                  className="hero-mm__main-grid"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0 }}
                >
                  <AIQuestionPanel
                    stepIndex={stepIndex}
                    answers={answers}
                    onAnswer={handleAnswer}
                    onBack={handleBack}
                    onContinue={handleContinue}
                    onSkip={handleSkip}
                    pigAnimate={pigAnimate}
                    reducedMotion={reducedMotion}
                  />
                  <StudentProfileSummary
                    profile={profile}
                    highlightedKey={highlightedKey}
                    reducedMotion={reducedMotion}
                  />
                </motion.div>
              ) : null}

              {phase === "matching" ? (
                <motion.div
                  key="matching"
                  className="hero-mm__matching-wrap"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0 }}
                >
                  <MatchingAnimation
                    reducedMotion={reducedMotion}
                    onComplete={() => setPhase("results")}
                  />
                </motion.div>
              ) : null}

              {phase === "results" ? (
                <motion.div
                  key="results"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0 }}
                >
                  <MentorMatchResults reducedMotion={reducedMotion} onRestart={handleRestart} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <PreludeAIChatBubble
        open={chatOpen}
        onToggle={setChatOpen}
        onStartMatch={handleStartFromChat}
        reducedMotion={reducedMotion}
      />
    </motion.div>
  );
}
