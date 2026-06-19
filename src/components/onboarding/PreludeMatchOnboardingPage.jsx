import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { PRELUDE_MATCH_QUESTIONS } from "../../data/preludeMatchQuestions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import { PARENT_ONBOARDING_PATH, userNeedsMatchOnboarding, userNeedsPlanSelection } from "../../lib/onboardingRoutes.js";
import {
  getMentorById,
  pickSuggestedMentor,
  saveMatchDecision,
  saveMatchQuestionnaire
} from "../../lib/preludeMatchService.js";
import {
  computeQuestionProgress,
  getQuestionIndex,
  getVisibleQuestions,
  pruneStaleAnswers
} from "../../lib/preludeMatchLogic.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import AppLink from "../AppLink.jsx";
import PreludeMatchBoot from "../hero/PreludeMatchBoot.jsx";
import PreludeMatchIntro from "../hero/PreludeMatchIntro.jsx";
import PreludeMatchLoading from "../hero/PreludeMatchLoading.jsx";
import PreludeMatchQuestionFlow from "../hero/PreludeMatchQuestionFlow.jsx";
import MatchResultPanel from "./MatchResultPanel.jsx";
import EmailVerificationBanner from "../EmailVerificationBanner.jsx";

export default function PreludeMatchOnboardingPage() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready, refreshUser } = useAuth();
  const forceResult = searchParams.get("step") === "result";

  const [phase, setPhase] = useState(forceResult ? "result" : "intro");
  const [answers, setAnswers] = useState(user?.questionnaireAnswers || {});
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [pigMotion, setPigMotion] = useState("none");
  const [progress, setProgress] = useState(0);
  const [suggestedMentor, setSuggestedMentor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    if (!user?.suggestedMentorId) return;
    const mentor = getMentorById(user.suggestedMentorId);
    if (mentor) setSuggestedMentor(mentor);
    if (forceResult || user.matchOnboardingComplete) setPhase("result");
  }, [user, forceResult]);

  const bumpPig = useCallback(() => {
    setPigMotion("bounce");
    const ms = reducedMotion ? 0 : 400;
    setTimeout(() => setPigMotion("none"), ms);
  }, [reducedMotion]);

  if (!ready) {
    return <main className="pm-onboarding-page"><p className="text-muted-foreground">Loading…</p></main>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: MATCH_ONBOARDING_PATH }} />;
  }

  if (userNeedsPlanSelection(user)) {
    return <Navigate to="/onboarding/plan" replace />;
  }

  if (roleFromUser(user) === "mentor") {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  if (!userNeedsMatchOnboarding(user) && !forceResult && user.matchDecision === "accepted") {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  function handleStart() {
    setAnswers(user?.questionnaireAnswers || {});
    setProgress(0);
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

  async function finishQuestionnaire(finalAnswers) {
    setPhase("loading");
    setProgress(90);
    setSaving(true);
    setError("");
    try {
      if (user.authProvider === "supabase") {
        const { suggestedMentor: suggested, error: err } = await saveMatchQuestionnaire(user.id, finalAnswers);
        if (err) throw new Error(err);
        setSuggestedMentor(suggested);
      } else {
        setSuggestedMentor(pickSuggestedMentor(finalAnswers));
      }
      await refreshUser();
      setProgress(100);
      setPhase("result");
    } catch (err) {
      setError(err.message || "Could not save your responses.");
      setPhase("questions");
    } finally {
      setSaving(false);
    }
  }

  function handleContinue() {
    const visible = getVisibleQuestions(PRELUDE_MATCH_QUESTIONS, answers);
    const idx = getQuestionIndex(visible, currentQuestionId);
    if (idx >= visible.length - 1) {
      finishQuestionnaire(answers);
      return;
    }
    const next = visible[idx + 1];
    setCurrentQuestionId(next.id);
    setProgress(computeQuestionProgress(idx + 1, visible.length));
    bumpPig();
  }

  function handleBack() {
    const visible = getVisibleQuestions(PRELUDE_MATCH_QUESTIONS, answers);
    const idx = getQuestionIndex(visible, currentQuestionId);
    if (idx <= 0) return;
    const prev = visible[idx - 1];
    setCurrentQuestionId(prev.id);
    setProgress(computeQuestionProgress(idx - 1, visible.length));
  }

  async function handleAccept() {
    const mentor = suggestedMentor || getMentorById(user.suggestedMentorId);
    if (!mentor) return;
    setSaving(true);
    try {
      if (user.authProvider === "supabase") {
        const { error: err } = await saveMatchDecision(user.id, { decision: "accepted", mentorId: mentor.id });
        if (err) throw new Error(err);
      }
      await refreshUser();
      navigate(PARENT_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDecline() {
    const mentor = suggestedMentor || getMentorById(user.suggestedMentorId);
    setSaving(true);
    try {
      if (user.authProvider === "supabase" && mentor) {
        const { error: err } = await saveMatchDecision(user.id, {
          decision: "declined",
          mentorId: mentor.id,
          declinedIds: [mentor.id]
        });
        if (err) throw new Error(err);
      }
      await refreshUser();
      navigate(PARENT_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isLastQuestion =
    currentQuestion &&
    getQuestionIndex(visibleQuestions, currentQuestion.id) === visibleQuestions.length - 1;

  const displayMentor = suggestedMentor || getMentorById(user.suggestedMentorId);
  const showVerifyBanner = !user.emailVerified && phase === "result";

  return (
    <main className={`pm-onboarding-page${showVerifyBanner ? " pm-onboarding-page--verify-banner" : ""}`}>
      <div className="pm-onboarding-page__inner">
        <AppLink href="/" className="pm-onboarding-page__back">← Back to Prelude</AppLink>
        <header className="pm-onboarding-page__head">
          <p className="plan-select-page__eyebrow">Step 2 of 2</p>
          <h1 className="pm-onboarding-page__title">Prelude Match</h1>
          <p className="pm-onboarding-page__sub">
            Tell us about your goals — we will recommend a mentor tailored to your preferences.
          </p>
        </header>

        {error ? <div className="plan-select-page__error">{error}</div> : null}

        <motion.div
          className="pm-card-wrap"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="pm-card-wrap__glow" aria-hidden="true" />
          <div className="pm-card pm-card--stable">
            <AnimatePresence mode="wait">
              {phase === "intro" ? (
                <motion.div key="intro" className="pm-card__panel" exit={{ opacity: 0 }}>
                  <PreludeMatchIntro onStart={handleStart} reducedMotion={reducedMotion} />
                </motion.div>
              ) : null}

              {phase === "boot" ? (
                <motion.div key="boot" className="pm-card__panel">
                  <PreludeMatchBoot reducedMotion={reducedMotion} onComplete={handleBootComplete} />
                </motion.div>
              ) : null}

              {phase === "questions" && currentQuestion ? (
                <motion.div key="questions" className="pm-card__panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <PreludeMatchQuestionFlow
                    question={currentQuestion}
                    answers={answers}
                    progress={progress}
                    onAnswer={handleAnswer}
                    onBack={handleBack}
                    onContinue={handleContinue}
                    onSkip={handleContinue}
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
                      if (!saving) setPhase("result");
                    }}
                  />
                </motion.div>
              ) : null}

              {phase === "result" && displayMentor ? (
                <motion.div key="result" className="pm-card__panel pm-card__panel--results">
                  <MatchResultPanel
                    mentor={displayMentor}
                    loading={saving}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                  />
                </motion.div>
              ) : null}

              {phase === "result" && !displayMentor ? (
                <motion.div key="result-empty" className="pm-card__panel">
                  <p className="pm-intro__body">We could not load your mentor match yet.</p>
                  <button type="button" className="pm-btn pm-btn--primary pm-btn--lg" onClick={handleStart}>
                    Start Prelude Match
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      {showVerifyBanner ? <EmailVerificationBanner /> : null}
    </main>
  );
}
