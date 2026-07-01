import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { PRELUDE_MATCH_QUESTIONS } from "../../data/preludeMatchQuestions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import {
  dashboardPathForRole,
  MATCH_ONBOARDING_PATH,
  PLAN_SELECTION_PATH,
  PARENT_ONBOARDING_PATH,
  postAuthDestination,
  userNeedsMatchOnboarding,
  userNeedsMatchDecision,
  userNeedsPlanSelection
} from "../../lib/onboardingRoutes.js";
import {
  pickSuggestedMentor,
  rankDemoMatchedMentors,
  saveMatchQuestionnaire
} from "../../lib/preludeMatchService.js";
import { loadMentorSelectionState, saveMentorSelection } from "../../lib/mentorSelectionApi.js";
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
import MentorMatchSelectionPanel from "./MentorMatchSelectionPanel.jsx";
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
  const [matchedMentors, setMatchedMentors] = useState([]);
  const [matchedMentorCount, setMatchedMentorCount] = useState(0);
  const [selectedMentorId, setSelectedMentorId] = useState(user?.selectedMentorId || null);
  const [selectionComplete, setSelectionComplete] = useState(Boolean(user?.mentorSelectionComplete));
  const [saving, setSaving] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
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

  const loadResultState = useCallback(async () => {
    if (!user) return;
    setLoadingResult(true);
    setError("");
    try {
      if (user.authProvider === "supabase") {
        const state = await loadMentorSelectionState();
        setMatchedMentors(state.mentors || []);
        setMatchedMentorCount(state.matchedMentorCount ?? 0);
        setSelectedMentorId(state.selectedMentorId || null);
        setSelectionComplete(Boolean(state.mentorSelectionComplete));
      } else {
        const demoMatches = rankDemoMatchedMentors(user.questionnaireAnswers || answers);
        setMatchedMentors(demoMatches);
        setMatchedMentorCount(demoMatches.length);
        setSelectionComplete(Boolean(user.mentorSelectionComplete));
      }
      setPhase("result");
    } catch (err) {
      setError(err.message || "Could not load your mentor matches.");
    } finally {
      setLoadingResult(false);
    }
  }, [user, answers]);

  useEffect(() => {
    if (!user?.matchOnboardingComplete && !forceResult) return;
    loadResultState();
  }, [user, forceResult, loadResultState]);

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

  if (userNeedsMatchDecision(user) && !forceResult && phase === "intro") {
    return <Navigate to={`${MATCH_ONBOARDING_PATH}?step=result`} replace />;
  }

  if (!userNeedsMatchOnboarding(user) && !userNeedsMatchDecision(user) && !forceResult) {
    return <Navigate to={postAuthDestination(user)} replace />;
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
        const {
          matchedMentors: mentors = [],
          matchedMentorCount: count = 0,
          error: err
        } = await saveMatchQuestionnaire(user.id, finalAnswers);
        if (err) throw new Error(err);
        setMatchedMentors(mentors);
        setMatchedMentorCount(count);
      } else {
        const demoMatches = rankDemoMatchedMentors(finalAnswers);
        setMatchedMentors(demoMatches);
        setMatchedMentorCount(demoMatches.length);
      }
      await refreshUser();
      setProgress(100);
      setPhase("result");
      if (user.authProvider === "supabase") {
        await loadResultState();
      }
    } catch (err) {
      setError(err.message || "Could not save your responses.");
      setPhase("questions");
    } finally {
      setSaving(false);
    }
  }

  function handleContinueQuestion() {
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

  async function handleMentorContinue() {
    if (selectionComplete) {
      navigate(PARENT_ONBOARDING_PATH, { replace: true });
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (user.authProvider === "supabase") {
        await saveMentorSelection({ selectedMentorId: selectedMentorId || null });
      }
      await refreshUser();
      navigate(PARENT_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setError(err.message || "Could not save your mentor selection.");
    } finally {
      setSaving(false);
    }
  }

  const isLastQuestion =
    currentQuestion &&
    getQuestionIndex(visibleQuestions, currentQuestion.id) === visibleQuestions.length - 1;

  const showVerifyBanner = !user.emailVerified && phase === "result";
  const showResultPanel = phase === "result" && !loadingResult;

  return (
    <main className={`pm-onboarding-page${showVerifyBanner ? " pm-onboarding-page--verify-banner" : ""}`}>
      <div className="pm-onboarding-page__inner">
        <nav className="pm-onboarding-page__nav" aria-label="Onboarding navigation">
          <AppLink href="/" className="pm-onboarding-page__back">← Back to Prelude</AppLink>
          <AppLink href={PLAN_SELECTION_PATH} className="pm-onboarding-page__back">← Back to plan selection</AppLink>
        </nav>
        <header className="pm-onboarding-page__head">
          <p className="plan-select-page__eyebrow">Step 2 of 2</p>
          <h1 className="pm-onboarding-page__title">Prelude Match</h1>
          <p className="pm-onboarding-page__sub">
            Tell us about your goals — we will recommend mentors tailored to your preferences.
          </p>
        </header>

        {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}

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
                    onContinue={handleContinueQuestion}
                    onSkip={handleContinueQuestion}
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

              {showResultPanel ? (
                <motion.div key="result" className="pm-card__panel pm-card__panel--results">
                  <MentorMatchSelectionPanel
                    mentors={matchedMentors}
                    matchedMentorCount={matchedMentorCount}
                    selectedMentorId={selectedMentorId}
                    loading={saving}
                    selectionComplete={selectionComplete}
                    onSelectMentor={setSelectedMentorId}
                    onContinue={handleMentorContinue}
                  />
                </motion.div>
              ) : null}

              {phase === "result" && loadingResult ? (
                <motion.div key="result-loading" className="pm-card__panel">
                  <p className="pm-intro__body">Loading your mentor matches…</p>
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
