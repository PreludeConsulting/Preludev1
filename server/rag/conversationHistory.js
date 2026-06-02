import { resolveCollegesFromText } from "../datasets/collegeAliases.js";

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;

export function sanitizeConversationHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item?.role === "user" || item?.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? item.text ?? "")
        .trim()
        .slice(0, MAX_MESSAGE_CHARS)
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

export function isAmbiguousFollowUp(message) {
  const text = message.trim();
  if (!text) return true;
  if (text.length <= 48) return true;
  return /\b(it|they|them|those|these|that|this|one|ones|cheaper|more affordable|better|yes|no|what do you mean|tell me more|what about|how about|where is it|which one|which of)\b/i.test(
    text
  );
}

export function buildRetrievalQuery(message, conversationHistory = []) {
  const sanitized = sanitizeConversationHistory(conversationHistory);
  const trimmed = message.trim();

  if (!sanitized.length || !isAmbiguousFollowUp(trimmed)) {
    return { query: trimmed, intentMessage: trimmed, history: sanitized };
  }

  const contextParts = sanitized
    .slice(-6)
    .map((item) => item.content)
    .join(" ");

  const combined = `${contextParts} ${trimmed}`.trim();
  return {
    query: combined,
    intentMessage: combined,
    history: sanitized
  };
}

export function extractInstitutionNamesFromText(text) {
  const schools = resolveCollegesFromText(text);
  return schools.map((school) => school.canonicalName).slice(0, 4);
}
