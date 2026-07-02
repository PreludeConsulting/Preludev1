import { sanitizeConversationHistory } from "./conversationHistory.js";
import { deriveConversationState } from "./conversationState.js";
import { deriveSchoolConversationContext } from "./schoolConversation.js";

const MAX_FLOW_HISTORY = 8;

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getRecentConversationMessages(history = []) {
  return history.slice(-MAX_FLOW_HISTORY);
}

function getLastAssistantMessage(history = []) {
  return [...getRecentConversationMessages(history)].reverse().find((item) => item.role === "assistant") ?? null;
}

function inferEssayStage(history) {
  const lastAssistant = getLastAssistantMessage(history);
  if (!lastAssistant) return null;

  const text = normalizeText(lastAssistant.content);

  if (/starting from scratch or revising a draft/.test(text)) {
    return "awaiting_draft_status";
  }

  if (/topic discovery|brainstorm|strong topic|meaningful story|values/.test(text)) {
    return "topic_discovery";
  }

  if (/paste your draft|share your draft|revising a draft/.test(text)) {
    return "awaiting_draft";
  }

  return null;
}

function inferSchoolStage(history, message) {
  const lastAssistant = getLastAssistantMessage(history);
  const schoolContext = deriveSchoolConversationContext(message, history);
  if (schoolContext.continuedFromPrior) {
    return "school_follow_up";
  }
  if (schoolContext.school && schoolContext.questionIntent && schoolContext.questionIntent !== "school_recommendation") {
    return "school_fact";
  }
  if (schoolContext.needsSchoolClarification) {
    return "awaiting_school";
  }
  if (lastAssistant && /\bwhich school are you asking about\b/i.test(lastAssistant.content ?? "")) {
    return "awaiting_school";
  }
  return null;
}

function inferMode(history, message) {
  const essayStage = inferEssayStage(history);
  if (essayStage) {
    return { mode: "essay_help", stage: essayStage };
  }

  const schoolStage = inferSchoolStage(history, message);
  if (schoolStage) {
    return { mode: "school_facts", stage: schoolStage };
  }

  return { mode: null, stage: null };
}

export function deriveActiveConversationState(message, conversationHistory = []) {
  const history = sanitizeConversationHistory(conversationHistory);
  const recentMessages = getRecentConversationMessages(history);
  const { mode, stage } = inferMode(recentMessages, message);
  const knownContext = deriveConversationState(message, history);
  const schoolContext = deriveSchoolConversationContext(message, history, knownContext);

  if (schoolContext.lastSchool) {
    knownContext.lastSchool = schoolContext.lastSchool;
    knownContext.lastSchoolName = schoolContext.lastSchool.metadata?.name ?? null;
    knownContext.lastSchoolUnitId = schoolContext.lastSchool.metadata?.unitid ?? null;
  }
  if (schoolContext.pendingSchoolTopic) {
    knownContext.pendingSchoolTopic = schoolContext.pendingSchoolTopic;
    knownContext.pendingSchoolIntent = schoolContext.pendingSchoolIntent;
  }

  return {
    mode: schoolContext.school || schoolContext.needsSchoolClarification ? "school_facts" : mode,
    stage:
      schoolContext.continuedFromPrior
        ? "school_follow_up"
        : schoolContext.needsSchoolClarification
          ? "awaiting_school"
          : schoolContext.school
            ? "school_fact"
            : stage,
    knownContext,
    recentMessages,
    active: Boolean(
      (mode && stage) ||
        schoolContext.school ||
        schoolContext.needsSchoolClarification ||
        schoolContext.continuedFromPrior
    )
  };
}
