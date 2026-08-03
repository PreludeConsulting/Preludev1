import { motion } from "motion/react";
import PreludePigAvatar from "./PreludePigAvatar.jsx";
import PreludeMatchQuestionCard from "./PreludeMatchQuestionCard.jsx";
import { canAdvanceQuestion } from "../../lib/preludeMatchLogic.js";

export default function PreludeMatchQuestionFlow({
  question,
  progress,
  answers,
  onAnswer,
  onBack,
  onContinue,
  onSkip,
  pigMotion,
  reducedMotion,
  canGoBack,
  isLast,
  submitting = false
}) {
  const currentAnswer = answers[question.id];
  const canContinue = canAdvanceQuestion(question, currentAnswer);
  const canSkip = !question.required;

  return (
    <div className="pm-flow">
      <header className="pm-flow__header">
        <PreludePigAvatar variant="question" motion={pigMotion} label="" />
        <div className="pm-flow__header-text">
          <p className="pm-flow__brand">PreludeMatch</p>
          <p className="pm-flow__label">Building your mentor profile</p>
        </div>
      </header>

      <div
        className="pm-progress"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Mentor profile progress"
      >
        <motion.div
          className="pm-progress__fill"
          animate={{ width: `${progress}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="pm-card__content">
        <PreludeMatchQuestionCard
          question={question}
          answer={currentAnswer}
          onAnswer={onAnswer}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="pm-flow__actions">
        {canGoBack ? (
          <button type="button" className="pm-btn pm-btn--ghost" onClick={onBack} disabled={submitting}>
            Back
          </button>
        ) : (
          <span />
        )}
        {canSkip ? (
          <button type="button" className="pm-btn pm-btn--ghost" onClick={onSkip} disabled={submitting}>
            Skip
          </button>
        ) : null}
        <button
          type="button"
          className="pm-btn pm-btn--primary"
          disabled={submitting || (!canContinue && !canSkip)}
          onClick={onContinue}
        >
          {submitting ? "Submitting..." : isLast ? "See my matches" : "Continue"}
        </button>
      </div>
    </div>
  );
}
