import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PRELUDE_MATCH_QUESTIONS } from "../../data/preludeMatchQuestions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import {
  dashboardPathForRole,
  MATCH_ONBOARDING_PATH,
  PARENT_ONBOARDING_PATH,
  postAuthDestination,
  userNeedsMatchOnboarding,
  userNeedsMatchDecision
} from "../../lib/onboardingRoutes.js";
import { getOnboardingProgress, getOnboardingStepNavigation } from "../../lib/onboardingFlow.js";
import {
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
import PreludePigAvatar from "../hero/PreludePigAvatar.jsx";
import EmailVerificationBanner from "../EmailVerificationBanner.jsx";
import { OnboardingProgress } from "./OnboardingShell.jsx";

export function MatchPendingPanel({ loading = false, onContinue, showAction = true, onEdit = null }) {
  return (
    <div className="pm-match-pending">
      <PreludePigAvatar size="lg" variant="intro" animate className="pm-match-pending__mascot" />
      <div className="pm-match-pending__body">
        <p className="pm-match-pending__eyebrow">Questionnaire submitted</p>
        <h2 className="pm-match-pending__title">Your mentor match is being processed</h2>
        <p className="pm-match-pending__lead">
          Thanks for completing the PreludeMatch questionnaire. Our team is reviewing your goals and preferences so we
          can find the best mentor for you.
        </p>
        <p className="pm-match-pending__lead">
          You&apos;ll receive an email soon with your recommended match.
        </p>
        <p className="pm-match-pending__status">We&apos;ll reach out as soon as your match is ready.</p>
      </div>
      {showAction || onEdit ? (
        <div className="pm-match-pending__actions">
          {onEdit ? (
            <button type="button" className="dash-btn dash-btn--secondary" onClick={onEdit}>
              Update answers
            </button>
          ) : null}
          {showAction ? (
            <button type="button" className="dash-btn dash-btn--primary" disabled={loading} onClick={onContinue}>
              Continue to parent invite
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MatchCompletePanel({ onEdit }) {
  return (
    <div className="pm-match-pending">
      <PreludePigAvatar size="lg" variant="intro" animate className="pm-match-pending__mascot" />
      <div className="pm-match-pending__body">
        <p className="pm-match-pending__eyebrow">Step complete</p>
        <h2 className="pm-match-pending__title">Prelude Match is complete</h2>
        <p className="pm-match-pending__lead">
          Your questionnaire responses are saved. Continue to meet your match, or update your answers before moving on.
        </p>
      </div>
      <div className="pm-match-pending__actions">
        <button type="button" className="dash-btn dash-btn--secondary" onClick={onEdit}>
          Update answers
        </button>
      </div>
    </div>
  );
}

export default function PreludeMatchOnboardingPage() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, ready, refreshUser } = useAuth();
  const forceResult = searchParams.get("step") === "result";

  const [phase, setPhase] = useState(forceResult ? "result" : "intro");
  const [answers, setAnswers] = useState(user?.questionnaireAnswers || {});
  const [editingAnswers, setEditingAnswers] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [pigMotion, setPigMotion] = useState("none");
  const [progress, setProgress] = useState(0);
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
    if (user?.questionnaireAnswers && Object.keys(user.questionnaireAnswers).length) {
      setAnswers(user.questionnaireAnswers);
    }
  }, [user?.questionnaireAnswers]);

  useEffect(() => {
    if (forceResult) {
      setError("");
      setEditingAnswers(false);
      setPhase("result");
      return;
    }
    setPhase((current) => (current === "result" ? "intro" : current));
    setEditingAnswers(false);
    setError("");
  }, [forceResult]);

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

  if (roleFromUser(user) === "mentor") {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  if (forceResult && !user.matchOnboardingComplete) {
    return <Navigate to={MATCH_ONBOARDING_PATH} replace />;
  }

  if (userNeedsMatchDecision(user) && !forceResult && phase === "intro") {
    return <Navigate to={`${MATCH_ONBOARDING_PATH}?step=result`} replace />;
  }

  if (!userNeedsMatchOnboarding(user) && !userNeedsMatchDecision(user) && !forceResult && !user.matchOnboardingComplete) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  const navigation = getOnboardingStepNavigation(user, location.pathname, new URLSearchParams(location.search));
  const stepProgress = getOnboardingProgress(user, location.pathname, new URLSearchParams(location.search));

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
        const { error: err } = await saveMatchQuestionnaire(user.id, finalAnswers);
        if (err) throw new Error(err);
      }
      await refreshUser();
      setProgress(100);
      setEditingAnswers(false);
      setPhase("result");
      navigate(`${MATCH_ONBOARDING_PATH}?step=result`, { replace: true });
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

  const isLastQuestion =
    currentQuestion &&
    getQuestionIndex(visibleQuestions, currentQuestion.id) === visibleQuestions.length - 1;

  const showResultPanel = phase === "result" && !editingAnswers;
  const showVerifyBanner = !user.emailVerified && showResultPanel;
  const showCompletedPanel = user.matchOnboardingComplete && !showResultPanel && !editingAnswers;
  const renderQuestionnaireFlow = !forceResult || editingAnswers;
  const cardVariant =
    phase === "questions" || phase === "boot"
      ? "questionnaire"
      : phase === "intro"
        ? "intro"
        : "panel";
  const nextHint = navigation.nextDisabled ? navigation.nextReason : "";

  function beginEditingAnswers() {
    const savedAnswers = user?.questionnaireAnswers || answers;
    const visible = getVisibleQuestions(PRELUDE_MATCH_QUESTIONS, savedAnswers);
    setAnswers(savedAnswers);
    setEditingAnswers(true);
    setError("");
    setPhase("questions");
    setCurrentQuestionId(visible[0]?.id || PRELUDE_MATCH_QUESTIONS[0].id);
    setProgress(computeQuestionProgress(0, visible.length));
    bumpPig();
  }

  function handleStepNext() {
    if (navigation.nextDisabled) {
      setError(navigation.nextReason || "Complete this step to continue.");
      return;
    }
    if (navigation.nextPath) navigate(navigation.nextPath);
  }

  return (
    <main className={`pm-onboarding-page${showVerifyBanner ? " pm-onboarding-page--verify-banner" : ""}`}>
      <div className="pm-onboarding-page__inner">
        <OnboardingProgress steps={stepProgress.steps} currentIndex={stepProgress.currentIndex} />
        <header className="pm-onboarding-page__head">
          <p className="plan-select-page__eyebrow">Prelude Match</p>
          <h1 className="pm-onboarding-page__title">Prelude Match</h1>
          <p className="pm-onboarding-page__sub">
            Tell us about your goals. Our team will review your answers and follow up with your mentor match.
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
          <div className={`pm-card pm-card--stable pm-card--${cardVariant}`}>
            <AnimatePresence mode="wait">
              {showCompletedPanel ? (
                <motion.div key="match-complete" className="pm-card__panel pm-card__panel--summary" exit={{ opacity: 0 }}>
                  <MatchCompletePanel onEdit={beginEditingAnswers} />
                </motion.div>
              ) : null}

              {!showCompletedPanel && renderQuestionnaireFlow && phase === "intro" ? (
                <motion.div key="intro" className="pm-card__panel" exit={{ opacity: 0 }}>
                  <PreludeMatchIntro onStart={handleStart} reducedMotion={reducedMotion} />
                </motion.div>
              ) : null}

              {!showCompletedPanel && renderQuestionnaireFlow && phase === "boot" ? (
                <motion.div key="boot" className="pm-card__panel">
                  <PreludeMatchBoot reducedMotion={reducedMotion} onComplete={handleBootComplete} />
                </motion.div>
              ) : null}

              {!showCompletedPanel && renderQuestionnaireFlow && phase === "questions" && currentQuestion ? (
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

              {!showCompletedPanel && renderQuestionnaireFlow && phase === "loading" ? (
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
                <motion.div key="result" className="pm-card__panel pm-card__panel--summary">
                  <MatchPendingPanel
                    loading={saving}
                    onContinue={() => navigate(PARENT_ONBOARDING_PATH)}
                    showAction={false}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
        <footer
          className={`onboarding-flow__footer pm-onboarding-page__footer${
            !navigation.showBack && navigation.showNext ? " onboarding-flow__footer--next-only" : ""
          }${navigation.showBack && !navigation.showNext ? " onboarding-flow__footer--back-only" : ""}`}
        >
          {navigation.showBack && navigation.backPath ? (
            <AppLink href={navigation.backPath} className="onboarding-flow__back-btn">
              <ArrowLeft aria-hidden="true" />
              Back
            </AppLink>
          ) : (
            <span />
          )}

          {navigation.showNext ? (
            <div className="onboarding-flow__continue-group">
              <button
                type="button"
                className="onboarding-flow__continue-btn"
                onClick={handleStepNext}
                disabled={navigation.nextDisabled || saving}
                aria-describedby={nextHint ? "pm-step-next-hint" : undefined}
              >
                Next
                <ArrowRight aria-hidden="true" />
              </button>
              {nextHint ? (
                <p id="pm-step-next-hint" className="onboarding-flow__continue-hint">
                  {nextHint}
                </p>
              ) : null}
            </div>
          ) : null}
        </footer>
      </div>
      {showVerifyBanner ? <EmailVerificationBanner /> : null}
    </main>
  );
}
