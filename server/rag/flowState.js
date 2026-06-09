import { sanitizeConversationHistory } from "./conversationHistory.js";
import { deriveConversationState } from "./conversationState.js";

const MAX_FLOW_HISTORY = 8;

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function inferEssayStage(history) {
  for (let index = history.length - 1; index >= Math.max(0, history.length - MAX_FLOW_HISTORY); index -= 1) {
    const item = history[index];
    const text = normalizeText(item.content);
    if (item.role !== "assistant") continue;

    if (/starting from scratch or revising a draft/.test(text)) {
      return "awaiting_draft_status";
    }

    if (/topic discovery|brainstorm|meaningful story|values/.test(text)) {
      return "topic_discovery";
    }

    if (/paste your draft|share your draft|revising a draft/.test(text)) {
      return "awaiting_draft";
    }
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
  const { mode, stage } = inferMode(history);
  const knownContext = deriveConversationState(message, history);

  return {
    mode,
    stage,
    knownContext,
    active: Boolean(mode && stage)
  };
}
