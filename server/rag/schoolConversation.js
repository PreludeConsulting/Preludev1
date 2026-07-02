import { sanitizeConversationHistory } from "./conversationHistory.js";
import { normalizeForIntentDetection } from "./inputNormalize.js";
import { lookupUniversityByName, lookupUniversityInText } from "./universityLookup.js";

const SCHOOL_CLARIFICATION_RE =
  /\b(which school|what school|which college|what college|which university|tell me which (school|college|university)|school are you asking about)\b/i;

const SCHOOL_NAME_ONLY_RE =
  /^[a-z0-9&.'\-\s]{2,80}$/i;

export const SCHOOL_TOPICS = {
  sat_average: /\b(average sat|sat average|sat score|what is the sat)\b/i,
  sat_benchmark: /\b(need on the sat|need.{0,24}sat|sat to get into|what sat|sat for|good enough|on track|competitive sat)\b/i,
  admission_rate: /\b(admission rate|acceptance rate|how selective|how hard to get in)\b/i,
  cost: /\b(cost|tuition|how much|afford|pay for|price)\b/i,
  act_average: /\b(average act|act score|what about act|act for)\b/i,
  overview: /\b(tell me about|what do you know about|info on|information about)\b/i
};

export function classifySchoolQuestionIntent(message) {
  const text = String(message ?? "");

  if (
    /\b(will i get|can i get accepted|can i get in|my chances|odds of|chances of getting|chance of admission|what are my chances)\b/i.test(
      text
    )
  ) {
    return "admission_prediction";
  }

  if (/\b(what schools|college list|build(?: me)? a (?:college|school) list|schools fit me|recommend colleges)\b/i.test(text)) {
    return "school_recommendation";
  }

  if (
    /\b(average sat|sat average|admission rate|acceptance rate|tuition|total cost|how much|need on the sat|sat to get into|get into|what sat)\b/i.test(
      text
    )
  ) {
    return "school_fact";
  }

  if (/\b(harvard|stanford|yale|mit|college|university|school)\b/i.test(text) && /\b(sat|act|cost|admission|accept)\b/i.test(text)) {
    return "school_fact";
  }

  return null;
}

export function detectSchoolTopic(message) {
  const text = String(message ?? "");
  for (const [topic, pattern] of Object.entries(SCHOOL_TOPICS)) {
    if (pattern.test(text)) return topic;
  }
  if (/\b(get into|into)\b/i.test(text) && /\b(sat|act|score)\b/i.test(text)) return "sat_benchmark";
  return "overview";
}

function getRecentMessages(history = [], limit = 10) {
  return sanitizeConversationHistory(history).slice(-limit);
}

function getLastAssistantMessage(history = []) {
  return [...getRecentMessages(history)].reverse().find((item) => item.role === "assistant") ?? null;
}

function getPriorUserMessage(history = [], excludeCurrent = "") {
  const users = getRecentMessages(history).filter((item) => item.role === "user");
  const filtered = users.filter((item) => item.content.trim() !== excludeCurrent.trim());
  return filtered.at(-1) ?? null;
}

function assistantAskedForSchool(lastAssistant) {
  return SCHOOL_CLARIFICATION_RE.test(lastAssistant?.content ?? "");
}

function isLikelySchoolNameReply(message) {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) return false;
  if (trimmed.split(/\s+/).length > 8) return false;
  if (lookupUniversityInText(trimmed) || lookupUniversityByName(trimmed)) return true;
  return SCHOOL_NAME_ONLY_RE.test(trimmed) && /\b(university|college|institute|tech)\b/i.test(trimmed);
}

function schoolFromConversationState(history = []) {
  for (const item of [...getRecentMessages(history)].reverse()) {
    const state = item.conversationState;
    if (state?.lastSchool?.metadata?.name) {
      return lookupUniversityByName(state.lastSchool.metadata.name) ?? state.lastSchool;
    }
    if (state?.lastSchoolName) {
      return lookupUniversityByName(state.lastSchoolName);
    }
  }
  return null;
}

function schoolFromHistoryMentions(history = []) {
  for (const item of [...getRecentMessages(history)].reverse()) {
    if (item.role !== "user") continue;
    const found = lookupUniversityInText(item.content);
    if (found) return found;
  }
  return null;
}

function isSchoolFollowUp(message, lastSchool) {
  if (!lastSchool) return false;
  const trimmed = String(message ?? "").trim();
  if (trimmed.length > 120) return false;
  return (
    /^(what about|how about)\b/i.test(trimmed) ||
    /^(admission rate|acceptance rate|cost|tuition|act|sat)\b/i.test(trimmed) ||
    /\b(for that school|for this school|there|that school|this school)\b/i.test(trimmed) ||
    (trimmed.split(/\s+/).length <= 6 && detectSchoolTopic(trimmed) !== "overview")
  );
}

export function deriveSchoolConversationContext(message, conversationHistory = [], priorState = {}) {
  const trimmed = normalizeForIntentDetection(message).text;
  const history = getRecentMessages(conversationHistory);
  const lastAssistant = getLastAssistantMessage(history);
  const askedForSchool = assistantAskedForSchool(lastAssistant);

  let school =
    lookupUniversityInText(trimmed) ||
    schoolFromConversationState(history) ||
    (priorState.lastSchool ? lookupUniversityByName(priorState.lastSchool.metadata?.name ?? priorState.lastSchoolName) : null);

  let topic = detectSchoolTopic(trimmed);
  let questionIntent = classifySchoolQuestionIntent(trimmed);
  let continuedFromPrior = false;

  if (askedForSchool && isLikelySchoolNameReply(trimmed)) {
    school = school || lookupUniversityInText(trimmed) || lookupUniversityByName(trimmed);
    const priorUser = getPriorUserMessage(history, trimmed);
    if (priorUser) {
      topic = priorState.pendingSchoolTopic || detectSchoolTopic(priorUser.content);
      questionIntent = priorState.pendingSchoolIntent || classifySchoolQuestionIntent(priorUser.content) || "school_fact";
      continuedFromPrior = true;
    }
  } else if (!school) {
    school = schoolFromHistoryMentions(history);
  }

  if (school && isSchoolFollowUp(trimmed, school) && questionIntent !== "school_recommendation") {
    topic = detectSchoolTopic(trimmed);
    questionIntent = questionIntent || "school_fact";
    continuedFromPrior = true;
  }

  if (school && !questionIntent && continuedFromPrior) {
    questionIntent = "school_fact";
  }

  const needsSchoolClarification =
    !school &&
    (questionIntent === "school_fact" || questionIntent === "admission_prediction" || questionIntent === "sat_benchmark");

  return {
    school,
    topic,
    questionIntent,
    needsSchoolClarification,
    continuedFromPrior,
    pendingSchoolTopic: needsSchoolClarification ? topic : null,
    pendingSchoolIntent: needsSchoolClarification ? questionIntent : null,
    lastSchool: school
  };
}

export function shouldHandleSchoolQuestion(context) {
  if (!context) return false;
  if (context.questionIntent === "school_recommendation") return false;
  if (context.school) return true;
  return Boolean(context.needsSchoolClarification && context.questionIntent);
}
