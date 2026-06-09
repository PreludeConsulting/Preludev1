/**
 * Normalized /api/chat response shape for all providers.
 */

import { sanitizeChatActions } from "./lib/chatLinkSecurity.js";

export function normalizeChatResponse(payload) {
  const answer = String(payload.text ?? payload.answer ?? "").trim();
  const actions = sanitizeChatActions(payload.actions);

  return {
    answer,
    text: answer,
    sources: Array.isArray(payload.sources) ? payload.sources : [],
    actions,
    fallback: payload.fallback ?? null,
    responseType: payload.responseType ?? null,
    mentorReferralReason: payload.mentorReferralReason ?? null,
    guidanceReason: payload.guidanceReason ?? null,
    intent: payload.intent ?? null,
    provider: payload.provider ?? null,
    model: payload.model ?? null,
    retrievedRecords: Array.isArray(payload.retrievedRecords) ? payload.retrievedRecords : []
  };
}
