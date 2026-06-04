/**
 * Resolves which PreludeMatch questions are visible based on prior answers.
 * @param {import('../data/preludeMatchQuestions.js').PRELUDE_MATCH_QUESTIONS[number][]} questions
 * @param {Record<string, unknown>} answers
 */
export function getVisibleQuestions(questions, answers) {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

export function isQuestionVisible(question, answers) {
  const rule = question.showWhen;
  if (!rule) return true;

  const value = answers[rule.questionId];
  if (value === undefined || value === null || value === "") return false;

  if (rule.equals !== undefined) {
    return value === rule.equals;
  }

  if (rule.equalsAny?.length) {
    return rule.equalsAny.includes(value);
  }

  if (rule.includesAny?.length) {
    if (Array.isArray(value)) {
      return rule.includesAny.some((opt) => value.includes(opt));
    }
    return rule.includesAny.includes(value);
  }

  return true;
}

/** Rough total for progress copy — updates as answers refine the path. */
export function estimateQuestionTotal(questions, answers) {
  const visible = getVisibleQuestions(questions, answers);
  const remainingSlots = questions.filter((q) => !visible.includes(q) && couldStillAppear(q, answers)).length;
  const estimate = visible.length + Math.min(remainingSlots, 4);
  return Math.max(visible.length, Math.min(15, Math.max(10, estimate)));
}

function couldStillAppear(question, answers) {
  if (!question.showWhen) return false;
  const parentAnswered = answers[question.showWhen.questionId] !== undefined;
  return parentAnswered && !isQuestionVisible(question, answers);
}

export function canAdvanceQuestion(question, answer) {
  if (!question.required) return true;

  switch (question.type) {
    case "multi-select":
    case "school-selector":
      return Array.isArray(answer) && answer.length > 0;
    case "open-response":
      return typeof answer === "string" && answer.trim().length > 0;
    case "scale":
      return typeof answer === "number";
    case "boolean":
      return typeof answer === "boolean";
    default:
      return answer !== undefined && answer !== null && answer !== "";
  }
}
