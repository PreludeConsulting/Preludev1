import { AnimatePresence, motion } from "motion/react";
import { HERO_MATCH_QUESTIONS } from "../../data/heroMentorMatch.js";
import AnswerChip from "./AnswerChip.jsx";
import PreludePigAvatar from "./PreludePigAvatar.jsx";
import SchoolAutocomplete from "./SchoolAutocomplete.jsx";

export default function AIQuestionPanel({
  stepIndex,
  answers,
  onAnswer,
  onBack,
  onContinue,
  onSkip,
  pigAnimate,
  reducedMotion
}) {
  const question = HERO_MATCH_QUESTIONS[stepIndex];
  const total = HERO_MATCH_QUESTIONS.length;
  const progress = ((stepIndex + 1) / total) * 100;

  const currentAnswer = answers[question.id];
  const canContinue =
    question.type === "schools"
      ? Array.isArray(currentAnswer) && currentAnswer.length > 0
      : Boolean(currentAnswer);

  return (
    <div className="hero-mm-question">
      <div className="hero-mm-question__header">
        <div>
          <p className="hero-mm-question__step" aria-live="polite">
            Step {question.step} of {total}
          </p>
          <div className="hero-mm-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              className="hero-mm-progress__fill"
              animate={{ width: `${progress}%` }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <h2 className="hero-mm-question__title">Let&apos;s find the right mentor for you.</h2>
      <p className="hero-mm-question__lede">
        Prelude AI asks a few focused questions, then matches you with mentors based on your goals, interests,
        background, and preferred support style.
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          className="hero-mm-question__card"
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.32 }}
        >
          <div className="hero-mm-question__ask">
            <PreludePigAvatar size="sm" animate={pigAnimate} reducedMotion={reducedMotion} />
            <p className="hero-mm-question__text">{question.question}</p>
          </div>

          {question.type === "schools" ? (
            <SchoolAutocomplete
              suggestions={question.suggestions}
              selected={Array.isArray(currentAnswer) ? currentAnswer : []}
              onChange={(schools) => onAnswer(question.id, schools)}
              reducedMotion={reducedMotion}
            />
          ) : (
            <div className="hero-mm-question__options" role="group" aria-label={question.question}>
              {question.options.map((option) => (
                <AnswerChip
                  key={option}
                  label={option}
                  selected={currentAnswer === option}
                  onSelect={(value) => onAnswer(question.id, value)}
                  reducedMotion={reducedMotion}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="hero-mm-question__actions">
        <button
          type="button"
          className="hero-mm-btn hero-mm-btn--ghost"
          onClick={onBack}
          disabled={stepIndex === 0}
        >
          Back
        </button>
        {stepIndex < total - 1 ? (
          <button type="button" className="hero-mm-btn hero-mm-btn--ghost" onClick={onSkip}>
            Skip
          </button>
        ) : null}
        <button
          type="button"
          className="hero-mm-btn hero-mm-btn--primary"
          disabled={!canContinue}
          onClick={onContinue}
        >
          {stepIndex === total - 1 ? "Find my mentors" : "Continue"}
        </button>
      </div>
    </div>
  );
}
