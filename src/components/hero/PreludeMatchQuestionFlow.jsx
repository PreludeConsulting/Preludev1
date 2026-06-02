import { motion } from "motion/react";
import PreludePigAvatar from "./PreludePigAvatar.jsx";
import PreludeMatchQuestionCard from "./PreludeMatchQuestionCard.jsx";

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
  isLast
}) {
  const currentAnswer = answers[question.id];
  const canContinue =
    question.required === false ||
    (question.type === "multi-select" || question.type === "college-search"
      ? Array.isArray(currentAnswer) && currentAnswer.length > 0
      : question.type === "open-response"
        ? typeof currentAnswer === "string" && currentAnswer.trim().length > 0
        : question.type === "scale"
          ? typeof currentAnswer === "number"
          : currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== "");

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
          <button type="button" className="pm-btn pm-btn--ghost" onClick={onBack}>
            Back
          </button>
        ) : (
          <span />
        )}
        {canSkip ? (
          <button type="button" className="pm-btn pm-btn--ghost" onClick={onSkip}>
            Skip
          </button>
        ) : null}
        <button
          type="button"
          className="pm-btn pm-btn--primary"
          disabled={!canContinue && !canSkip}
          onClick={onContinue}
        >
          {isLast ? "See my matches" : "Continue"}
        </button>
      </div>
    </div>
  );
}
