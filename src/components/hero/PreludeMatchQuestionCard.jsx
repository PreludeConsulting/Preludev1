import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import AnswerChip from "./AnswerChip.jsx";
import PreludeCollegeSearch from "./PreludeCollegeSearch.jsx";
import PreludeMatchSlider from "./PreludeMatchSlider.jsx";
import { toggleMultiSelect } from "../../lib/preludeMatchLogic.js";

export default function PreludeMatchQuestionCard({ question, answer, onAnswer, reducedMotion }) {
  const current = answer;

  useEffect(() => {
    if (question.type === "scale" && current === undefined) {
      onAnswer(question.id, question.scale?.min ?? 1);
    }
  }, [question.id, question.type, question.scale?.min, current, onAnswer]);

  function renderInput() {
    switch (question.type) {
      case "college-search":
        return (
          <PreludeCollegeSearch
            selected={Array.isArray(current) ? current : []}
            onChange={(colleges) => onAnswer(question.id, colleges)}
            reducedMotion={reducedMotion}
          />
        );

      case "multi-select":
        return (
          <div className="pm-q-card__options" role="group" aria-label={question.question}>
            {question.options?.map((option) => {
              const selected = Array.isArray(current) && current.includes(option);
              return (
                <AnswerChip
                  key={option}
                  label={option}
                  selected={selected}
                  onSelect={() => onAnswer(question.id, toggleMultiSelect(current, option, question.maxChoices))}
                  reducedMotion={reducedMotion}
                />
              );
            })}
          </div>
        );

      case "open-response":
        return (
          <textarea
            className="pm-q-card__textarea"
            rows={2}
            placeholder={question.placeholder ?? "Share a quick note…"}
            value={typeof current === "string" ? current : ""}
            onChange={(e) => onAnswer(question.id, e.target.value)}
          />
        );

      case "scale": {
        const min = question.scale?.min ?? 1;
        const max = question.scale?.max ?? 5;
        const value = typeof current === "number" ? current : min;
        return (
          <PreludeMatchSlider
            value={value}
            min={min}
            max={max}
            lowLabel={question.scale?.lowLabel ?? "Flexible"}
            highLabel={question.scale?.highLabel ?? "Structured"}
            onChange={(v) => onAnswer(question.id, v)}
          />
        );
      }

      default:
        return (
          <div className="pm-q-card__options pm-q-card__options--single" role="group" aria-label={question.question}>
            {question.options?.map((option) => (
              <AnswerChip
                key={option}
                label={option}
                selected={current === option}
                onSelect={() => onAnswer(question.id, option)}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        );
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        className="pm-q-card"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.24 }}
      >
        <p className="pm-q-card__text">{question.question}</p>
        {question.helperText ? <p className="pm-q-card__helper">{question.helperText}</p> : null}
        {renderInput()}
      </motion.div>
    </AnimatePresence>
  );
}
