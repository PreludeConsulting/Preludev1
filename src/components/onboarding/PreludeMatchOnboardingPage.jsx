import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { PRELUDE_MATCH_QUESTIONS } from "../../data/preludeMatchQuestions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import {
  dashboardPathForRole,
  MATCH_ONBOARDING_PATH,
  PARENT_ONBOARDING_PATH,
  ROLE_SELECTION_PATH,
  postAuthDestination,
  userNeedsMatchOnboarding,
  userNeedsMatchDecision,
  userNeedsParentInviteStep
} from "../../lib/onboardingRoutes.js";
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

export function MatchPendingPanel({ loading = false, onContinue }) {
  return (
    <div className="pm-match-pending">
      <PreludePigAvatar size="lg" variant="intro" animate className="pm-match-pending__mascot" />
      <header className="pm-match-pending__head">
        <h2 className="pm-results__title">Your mentor match is being processed</h2>
        <p className="pm-results__sub">
          Thanks for completing the PreludeMatch questionnaire. Our team is reviewing your goals and preferences so we
          can find the best mentor for you. You'll receive an email soon with your recommended match.
        </p>
      </header>
      <p className="pm-match-pending__note">We'll reach out as soon as your match is ready.</p>
      <div className="pm-match-result__actions">
        <button type="button" className="dash-btn dash-btn--primary" disabled={loading} onClick={onContinue}>
          Continue to parent invite
        </button>
      </div>
    </div>
  );
}

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

  const loadResultState = useCallback(async () => {
    if (!user) return;
    setError("");
    setPhase("result");
  }, [user]);

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

  if (roleFromUser(user) === "mentor") {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  if (userNeedsMatchDecision(user) && !forceResult && phase === "intro") {
    return <Navigate to={`${MATCH_ONBOARDING_PATH}?step=result`} replace />;
  }

  const shouldShowProcessingStep = user.matchOnboardingComplete && userNeedsParentInviteStep(user);

  if (!userNeedsMatchOnboarding(user) && !userNeedsMatchDecision(user) && !forceResult && !shouldShowProcessingStep) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  const renderQuestionnaireFlow = !shouldShowProcessingStep;

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
      setPhase("result");
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

  const showVerifyBanner = !user.emailVerified && (phase === "result" || shouldShowProcessingStep);
  const showResultPanel = phase === "result" || shouldShowProcessingStep;

  return (
    <main className={`pm-onboarding-page${showVerifyBanner ? " pm-onboarding-page--verify-banner" : ""}`}>
      <div className="pm-onboarding-page__inner">
        <nav className="pm-onboarding-page__nav" aria-label="Onboarding navigation">
          <AppLink href={ROLE_SELECTION_PATH} className="pm-onboarding-page__back">← Back to role selection</AppLink>
        </nav>
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
          <div className="pm-card pm-card--stable">
            <AnimatePresence mode="wait">
              {renderQuestionnaireFlow && phase === "intro" ? (
                <motion.div key="intro" className="pm-card__panel" exit={{ opacity: 0 }}>
                  <PreludeMatchIntro onStart={handleStart} reducedMotion={reducedMotion} />
                </motion.div>
              ) : null}

              {renderQuestionnaireFlow && phase === "boot" ? (
                <motion.div key="boot" className="pm-card__panel">
                  <PreludeMatchBoot reducedMotion={reducedMotion} onComplete={handleBootComplete} />
                </motion.div>
              ) : null}

              {renderQuestionnaireFlow && phase === "questions" && currentQuestion ? (
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

              {renderQuestionnaireFlow && phase === "loading" ? (
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
                  <MatchPendingPanel
                    loading={saving}
                    onContinue={() => navigate(PARENT_ONBOARDING_PATH, { replace: true })}
                  />
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
