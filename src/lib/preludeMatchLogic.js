import { PRELUDE_MATCH_QUESTIONS } from "../data/preludeMatchQuestions.js";

function answerIncludesAny(answer, values) {
  if (!Array.isArray(answer)) return values.includes(answer);
  return values.some((v) => answer.includes(v));
}

function hasRealCollegeSelection(answer) {
  if (!Array.isArray(answer) || answer.length === 0) return false;
  return answer.some((item) => {
    if (typeof item === "string") return item !== "Still exploring";
    return item?.name && item.name !== "Still exploring";
  });
}

function ruleMatches(rule, answers) {
  if (rule.anyOf?.length) {
    return rule.anyOf.some((sub) => ruleMatches(sub, answers));
  }

  if (rule.minNumber) {
    const { questionId, value } = rule.minNumber;
    const num = answers[questionId];
    if (typeof num !== "number" || num < value) return false;
  }

  if (rule.hasCollegeSelection) {
    return hasRealCollegeSelection(answers[rule.questionId ?? "colleges"]);
  }

  if (rule.anyIncludes?.length) {
    if (!rule.anyIncludes.some(({ questionId, values }) => answerIncludesAny(answers[questionId], values))) {
      return false;
    }
  }

  if (rule.questionId && rule.equals !== undefined) {
    return answers[rule.questionId] === rule.equals;
  }

  if (rule.questionId && rule.includesAny?.length) {
    const value = answers[rule.questionId];
    if (value === undefined || value === null || value === "") return false;
    return answerIncludesAny(value, rule.includesAny);
  }

  if (rule.minNumber || rule.hasCollegeSelection || rule.anyIncludes) {
    return true;
  }

  return true;
}

export function isQuestionVisible(question, answers) {
  const rule = question.showWhen;
  if (!rule) return true;
  return ruleMatches(rule, answers);
}

export function getVisibleQuestions(questions = PRELUDE_MATCH_QUESTIONS, answers) {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

export function pruneStaleAnswers(questions, answers, changedQuestionId) {
  const changedIndex = questions.findIndex((q) => q.id === changedQuestionId);
  if (changedIndex < 0) return answers;

  const next = { ...answers };
  for (let i = changedIndex + 1; i < questions.length; i += 1) {
    const q = questions[i];
    if (!isQuestionVisible(q, next)) {
      delete next[q.id];
    }
  }
  return next;
}

export function computeQuestionProgress(currentIndex, visibleLength) {
  if (visibleLength <= 1) return 0;
  return Math.round((currentIndex / visibleLength) * 90);
}

export function canAdvanceQuestion(question, answer) {
  if (!question.required) return true;

  switch (question.type) {
    case "multi-select":
    case "college-search":
      return Array.isArray(answer) && answer.length > 0;
    case "open-response":
      return typeof answer === "string" && answer.trim().length > 0;
    case "scale":
      return typeof answer === "number";
    default:
      return answer !== undefined && answer !== null && answer !== "";
  }
}

export function toggleMultiSelect(current, option, maxChoices) {
  const prev = Array.isArray(current) ? current : [];
  if (prev.includes(option)) {
    return prev.filter((v) => v !== option);
  }
  if (maxChoices && prev.length >= maxChoices) return prev;
  return [...prev, option];
}

export function getQuestionIndex(visible, questionId) {
  return visible.findIndex((q) => q.id === questionId);
}
