import { sanitizeConversationHistory } from "./conversationHistory.js";
import { deriveConversationState } from "./conversationState.js";

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

function inferMode(history) {
  const essayStage = inferEssayStage(history);
  if (essayStage) {
    return { mode: "essay_help", stage: essayStage };
  }

  return { mode: null, stage: null };
}

export function deriveActiveConversationState(message, conversationHistory = []) {
  const history = sanitizeConversationHistory(conversationHistory);
  const recentMessages = getRecentConversationMessages(history);
  const { mode, stage } = inferMode(recentMessages);
  const knownContext = deriveConversationState(message, history);

  return {
    mode,
    stage,
    knownContext,
    recentMessages,
    active: Boolean(mode && stage)
  };
}
