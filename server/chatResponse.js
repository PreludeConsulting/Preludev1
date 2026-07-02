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
    sourceLabels: Array.isArray(payload.sourceLabels)
      ? payload.sourceLabels
      : Array.isArray(payload.sources)
        ? payload.sources
        : [],
    actions,
    fallback: payload.fallback ?? null,
    type: payload.type ?? payload.responseType ?? null,
    responseType: payload.responseType ?? payload.type ?? null,
    category: payload.category ?? null,
    ctaLabel: payload.ctaLabel ?? null,
    ctaTarget: payload.ctaTarget ?? null,
    mentorReferralReason: payload.mentorReferralReason ?? null,
    guidanceReason: payload.guidanceReason ?? null,
    intent: payload.intent ?? null,
    provider: payload.provider ?? null,
    model: payload.model ?? null,
    retrievedRecords: Array.isArray(payload.retrievedRecords) ? payload.retrievedRecords : [],
    conversationState:
      payload.conversationState && typeof payload.conversationState === "object" ? payload.conversationState : {}
  };
}
