import {
  deriveSchoolConversationContext,
  shouldHandleSchoolQuestion
} from "../schoolConversation.js";
import { buildSchoolClarificationAnswer, buildSchoolFactAnswer } from "../schoolAnswers.js";

export function tryBuildSchoolAnswer({ message, conversationHistory = [], profile = null, priorState = {} }) {
  const context = deriveSchoolConversationContext(message, conversationHistory, priorState);
  if (!shouldHandleSchoolQuestion(context)) return null;

  if (context.needsSchoolClarification && !context.school) {
    const clarification = buildSchoolClarificationAnswer(context);
    return {
      ...clarification,
      provider: "prelude",
      model: "school_facts",
      intent: context.questionIntent ?? "school_fact"
    };
  }

  if (!context.school) return null;

  const answer = buildSchoolFactAnswer({
    school: context.school,
    topic: context.topic,
    questionIntent: context.questionIntent,
    profile
  });

  return {
    ...answer,
    provider: "prelude",
    model: "school_facts",
    intent: context.questionIntent ?? "school_fact"
  };
}

export function handleSchoolFlow({ message, conversationHistory = [], flowState, profile = null }) {
  const priorState = flowState?.knownContext ?? {};
  const result = tryBuildSchoolAnswer({
    message,
    conversationHistory,
    profile,
    priorState
  });

  if (!result) return null;

  return {
    text: result.text,
    answer: result.text,
    provider: result.provider,
    model: result.model,
    intent: result.intent,
    sources: result.sources ?? [],
    sourceLabels: result.sourceLabels ?? ["Prelude University Database"],
    retrievedRecords: result.retrievedRecords ?? [],
    conversationState: {
      ...(flowState?.knownContext ?? {}),
      ...(result.conversationState ?? {})
    },
    activeFlow: {
      mode: "school_facts",
      stage: result.conversationState?.pendingSchoolTopic ? "awaiting_school" : "answered"
    }
  };
}
