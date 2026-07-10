import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PRELUDE_MATCH_QUESTIONS } from "../../data/preludeMatchQuestions.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import {
  computeQuestionProgress,
  getQuestionIndex,
  getVisibleQuestions,
  pruneStaleAnswers
} from "../../lib/preludeMatchLogic.js";
import { requestMentorMatch } from "../../lib/mentorMatch.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import PreludeMatchBoot from "./PreludeMatchBoot.jsx";
import PreludeMatchIntro from "./PreludeMatchIntro.jsx";
import PreludeMatchLoading from "./PreludeMatchLoading.jsx";
import PreludeMatchQuestionFlow from "./PreludeMatchQuestionFlow.jsx";
import PreludeMatchResults from "./PreludeMatchResults.jsx";

export default function PreludeMatch({ onStartOverride = null } = {}) {
  const reducedMotion = useReducedMotion();
  const { t } = useLanguage();
  const [phase, setPhase] = useState("intro");
  const [answers, setAnswers] = useState({});
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [pigMotion, setPigMotion] = useState("none");
  const [progress, setProgress] = useState(0);
  const [matchSummary, setMatchSummary] = useState("");

  const visibleQuestions = useMemo(
    () => getVisibleQuestions(PRELUDE_MATCH_QUESTIONS, answers),
    [answers]
  );

  const currentIndex = useMemo(() => {
    if (!currentQuestionId) return 0;
    const idx = getQuestionIndex(visibleQuestions, currentQuestionId);
    return idx >= 0 ? idx : 0;
  }, [visibleQuestions, currentQuestionId]);

  const currentQuestion = visibleQuestions[currentIndex] ?? visibleQuestions[0];

  useEffect(() => {
    if (phase !== "questions" || !currentQuestionId) return;
    const idx = getQuestionIndex(visibleQuestions, currentQuestionId);
    if (idx < 0 && visibleQuestions[0]) {
      setCurrentQuestionId(visibleQuestions[0].id);
    }
  }, [phase, currentQuestionId, visibleQuestions]);

  useEffect(() => {
    if (phase === "questions") {
      setProgress(computeQuestionProgress(currentIndex, visibleQuestions.length));
    }
  }, [phase, currentIndex, visibleQuestions.length]);

  const bumpPig = useCallback(() => {
    setPigMotion("bounce");
    const ms = reducedMotion ? 0 : 400;
    setTimeout(() => setPigMotion("none"), ms);
  }, [reducedMotion]);

  function handleStart() {
    if (onStartOverride) {
      onStartOverride();
      return;
    }
    setAnswers({});
    setProgress(0);
    setMatchSummary("");
    setPhase(reducedMotion ? "questions" : "boot");
    setCurrentQuestionId(PRELUDE_MATCH_QUESTIONS[0].id);
  }

  function handleBootComplete() {
    setPhase("questions");
    setCurrentQuestionId(PRELUDE_MATCH_QUESTIONS[0].id);
    setProgress(computeQuestionProgress(0, getVisibleQuestions(PRELUDE_MATCH_QUESTIONS, {}).length));
    bumpPig();
  }

  function handleAnswer(questionId, value) {
    setAnswers((prev) => {
      const withAnswer = { ...prev, [questionId]: value };
      return pruneStaleAnswers(PRELUDE_MATCH_QUESTIONS, withAnswer, questionId);
    });
  }

  async function handleContinue() {
    const visible = getVisibleQuestions(PRELUDE_MATCH_QUESTIONS, answers);
    const idx = getQuestionIndex(visible, currentQuestionId);

    if (idx >= visible.length - 1) {
      setProgress(90);
      setPhase("loading");
      try {
        const match = await requestMentorMatch(answers);
        setMatchSummary(match?.summary ?? "");
      } catch {
        setMatchSummary("");
      }
      return;
    }

    const next = visible[idx + 1];
    setCurrentQuestionId(next.id);
    setProgress(computeQuestionProgress(idx + 1, visible.length));
    bumpPig();
  }

  function handleSkip() {
    handleContinue();
  }

  function handleBack() {
    const visible = getVisibleQuestions(PRELUDE_MATCH_QUESTIONS, answers);
    const idx = getQuestionIndex(visible, currentQuestionId);
    if (idx <= 0) return;
    const prev = visible[idx - 1];
    setCurrentQuestionId(prev.id);
    setProgress(computeQuestionProgress(idx - 1, visible.length));
  }

  function handleRestart() {
    setPhase("intro");
    setAnswers({});
    setCurrentQuestionId(null);
    setPigMotion("none");
    setProgress(0);
    setMatchSummary("");
  }

  const isLastQuestion =
    currentQuestion &&
    getQuestionIndex(visibleQuestions, currentQuestion.id) === visibleQuestions.length - 1;

  return (
    <motion.div
      className="pm-card-wrap"
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-label={t("match.ariaLabel")}
    >
      <div className="pm-card-wrap__glow" aria-hidden="true" />

      <div className="pm-card pm-card--stable">
        <div className="pm-card__browser-chrome" aria-hidden="true">
          <span className="pm-card__traffic-light pm-card__traffic-light--red" />
          <span className="pm-card__traffic-light pm-card__traffic-light--yellow" />
          <span className="pm-card__traffic-light pm-card__traffic-light--green" />
        </div>

        <AnimatePresence mode="wait">
          {phase === "intro" ? (
            <motion.div
              key="intro"
              className="pm-card__panel pm-card__panel--intro"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <PreludeMatchIntro reducedMotion={reducedMotion} onStart={handleStart} />
            </motion.div>
          ) : null}

          {phase === "boot" ? (
            <motion.div key="boot" className="pm-card__panel">
              <PreludeMatchBoot reducedMotion={reducedMotion} onComplete={handleBootComplete} />
            </motion.div>
          ) : null}

          {phase === "questions" && currentQuestion ? (
            <motion.div
              key="questions"
              className="pm-card__panel"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <PreludeMatchQuestionFlow
                question={currentQuestion}
                answers={answers}
                progress={progress}
                onAnswer={handleAnswer}
                onBack={handleBack}
                onContinue={handleContinue}
                onSkip={handleSkip}
                pigMotion={pigMotion}
                reducedMotion={reducedMotion}
                canGoBack={currentIndex > 0}
                isLast={isLastQuestion}
              />
            </motion.div>
          ) : null}

          {phase === "loading" ? (
            <motion.div key="loading" className="pm-card__panel">
              <PreludeMatchLoading
                reducedMotion={reducedMotion}
                progressFrom={progress}
                onComplete={() => {
                  setProgress(100);
                  setPhase("results");
                }}
              />
            </motion.div>
          ) : null}

          {phase === "results" ? (
            <motion.div key="results" className="pm-card__panel pm-card__panel--results">
              <PreludeMatchResults reducedMotion={reducedMotion} onRestart={handleRestart} matchSummary={matchSummary} />
            </motion.div>
          ) : null}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}
