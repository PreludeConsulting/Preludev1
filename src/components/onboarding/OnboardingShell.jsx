import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import AppLink from "../AppLink.jsx";
import { getOnboardingProgress, getOnboardingStepNavigation } from "../../lib/onboardingFlow.js";
import { ROLE_SELECTION_PATH } from "../../lib/onboardingRoutes.js";
import { canAccessDashboard } from "../../lib/onboardingRoutes.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

export function OnboardingProgress({ steps, currentIndex }) {
  if (!steps.length) return null;
  return (
    <div className="onboarding-flow__progress" aria-label="Onboarding progress">
      <div className="onboarding-flow__progress-track" aria-hidden="true">
        <span
          className="onboarding-flow__progress-fill"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
      <ol className="onboarding-flow__progress-steps">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`onboarding-flow__progress-step ${
              index < currentIndex ? "onboarding-flow__progress-step--done" : ""
            } ${index === currentIndex ? "onboarding-flow__progress-step--current" : ""}`}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            <span className="onboarding-flow__progress-dot" aria-hidden="true" />
            <span className="onboarding-flow__progress-label">{step.title}</span>
          </li>
        ))}
      </ol>
      <p className="onboarding-flow__progress-meta">
        Step {currentIndex + 1} of {steps.length}
      </p>
    </div>
  );
}

export default function OnboardingShell({
  user,
  loading = false,
  title,
  subtitle,
  eyebrow,
  children,
  backHref,
  onBack,
  continueLabel = "Continue",
  onContinue,
  continueDisabled = false,
  continueHint = "",
  continueLoading = false,
  useStepCompletionGate = true,
  hideContinue = false,
  hideHomeLink = false,
  footerNote = "",
  className = ""
}) {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const progress = useMemo(
    () => getOnboardingProgress(user, location.pathname, new URLSearchParams(location.search)),
    [user, location.pathname, location.search]
  );
  const stepNavigation = useMemo(
    () => (user ? getOnboardingStepNavigation(user, location.pathname, new URLSearchParams(location.search)) : null),
    [user, location.pathname, location.search]
  );
  const showBack = Boolean(onBack || backHref || stepNavigation?.showBack);
  const resolvedBackHref = backHref || stepNavigation?.backPath;
  const stepGateDisabled = useStepCompletionGate ? Boolean(stepNavigation?.nextDisabled) : false;
  const resolvedContinueDisabled = continueDisabled || stepGateDisabled;
  const resolvedContinueHint = continueHint || (stepGateDisabled ? stepNavigation?.nextReason : "") || "";
  const continueHintId = resolvedContinueHint ? "onboarding-continue-hint" : undefined;
  const homeHref = !hideHomeLink && user && !canAccessDashboard(user) && location.pathname !== ROLE_SELECTION_PATH
    ? ROLE_SELECTION_PATH
    : "/";
  const homeLabel = homeHref === ROLE_SELECTION_PATH ? "← Back to role selection" : "← Back to Prelude";

  return (
    <main className={`onboarding-flow ${className}`.trim()}>
      <div className="onboarding-flow__inner">
        {!hideHomeLink ? (
          <AppLink href={homeHref} className="onboarding-flow__home-link">
            {homeLabel}
          </AppLink>
        ) : null}

        <OnboardingProgress steps={progress.steps} currentIndex={progress.currentIndex} />

        <header className="onboarding-flow__head">
          {eyebrow ? <p className="onboarding-flow__eyebrow">{eyebrow}</p> : null}
          <h1 className="onboarding-flow__title">{title}</h1>
          {subtitle ? <p className="onboarding-flow__subtitle">{subtitle}</p> : null}
        </header>

        <div
          className={`onboarding-flow__body ${reducedMotion ? "onboarding-flow__body--static" : ""}`}
          key={reducedMotion ? location.pathname : undefined}
        >
          {loading ? (
            <div className="onboarding-flow__loading" aria-live="polite">
              <Loader2 className="onboarding-flow__spinner" aria-hidden="true" />
              <span>Loading your setup…</span>
            </div>
          ) : (
            children
          )}
        </div>

        {!hideContinue || showBack ? (
          <footer
            className={`onboarding-flow__footer${
              hideContinue && showBack ? " onboarding-flow__footer--back-only" : ""
            }${!hideContinue && !showBack ? " onboarding-flow__footer--next-only" : ""}`}
          >
            {showBack ? (
              resolvedBackHref ? (
                <AppLink href={resolvedBackHref} className="onboarding-flow__back-btn" onClick={onBack}>
                  <ArrowLeft aria-hidden="true" />
                  Back
                </AppLink>
              ) : onBack ? (
                <button type="button" className="onboarding-flow__back-btn" onClick={onBack} disabled={continueLoading}>
                  <ArrowLeft aria-hidden="true" />
                  Back
                </button>
              ) : (
                <span />
              )
            ) : (
              <span />
            )}

            {!hideContinue ? (
              <div className="onboarding-flow__continue-group">
                <button
                  type="button"
                  className="onboarding-flow__continue-btn"
                  onClick={onContinue}
                  disabled={resolvedContinueDisabled || continueLoading}
                  aria-busy={continueLoading}
                  aria-describedby={continueHintId}
                >
                  {continueLoading ? (
                    <>
                      <Loader2 className="onboarding-flow__spinner" aria-hidden="true" />
                      Saving…
                    </>
                  ) : (
                    <>
                      {continueLabel}
                      <ArrowRight aria-hidden="true" />
                    </>
                  )}
                </button>
                {resolvedContinueHint && resolvedContinueDisabled ? (
                  <p id={continueHintId} className="onboarding-flow__continue-hint">
                    {resolvedContinueHint}
                  </p>
                ) : null}
              </div>
            ) : null}
          </footer>
        ) : null}

        {footerNote ? <p className="onboarding-flow__note">{footerNote}</p> : null}
      </div>
    </main>
  );
}
