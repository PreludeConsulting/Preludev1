import { buildChatModelConfig } from "./aiConfig.js";
import { callChatModel } from "./chatModel.js";
import { DatabaseNotFoundError } from "./db/sqlite.js";
import {
  buildRetrievalQuery,
  sanitizeConversationHistory
} from "./rag/conversationHistory.js";
import {
  buildProfileAddon,
  buildRagChatMessages,
  loadPreludeInstructions,
  uniqueSourceLabels
} from "./rag/promptBuilder.js";
import { normalizeChatResponse } from "./chatResponse.js";
import {
  classifyPostLlmFallback,
  classifyPreLlmFallback
} from "./rag/fallback.js";
import { classifyIntent, isPreludeBusinessIntent } from "./rag/intent.js";
import { buildPreludeBusinessAnswer } from "./rag/preludeBusiness.js";
import { retrieveContext } from "./rag/retrieval.js";
import {
  buildMandatoryFallbackAnswer,
  buildRetrievalAssistedAnswer,
  buildStaticGuidanceAnswer,
  isLowQualityLlmAnswer,
  isOffTopicMessage,
  shouldPreferRetrievalAnswer
} from "./rag/retrievalAnswer.js";

function resolveConfig(config = {}) {
  return {
    ...buildChatModelConfig(),
    ...config,
    provider: config.provider ?? buildChatModelConfig().provider
  };
}

function buildLegacySystemPrompt(profile) {
  const instructions = loadPreludeInstructions();
  let prompt = `${instructions.system}\n\n---\n\n## Reference knowledge\n\n${instructions.knowledge}`;
  prompt += buildProfileAddon(profile);
  return prompt;
}

export async function createChatCompletion(messages, config = {}, profile = null) {
  const resolvedConfig = resolveConfig(config);

  if (!Array.isArray(messages) || messages.length === 0) {
    const error = new Error("messages must be a non-empty array");
    error.code = "BAD_REQUEST";
    throw error;
  }

  const systemPrompt = buildLegacySystemPrompt(profile);
  const chatMessages = [{ role: "system", content: systemPrompt }, ...messages];

  return callChatModel(chatMessages, resolvedConfig);
}

export async function createRagChatCompletion({ message, conversationHistory = [] }, config = {}, profile = null) {
  const resolvedConfig = resolveConfig(config);

  const trimmedMessage = String(message ?? "").trim();
  if (!trimmedMessage) {
    const error = new Error("message is required");
    error.code = "BAD_REQUEST";
    throw error;
  }

  const history = sanitizeConversationHistory(conversationHistory);
  const { intentMessage } = buildRetrievalQuery(trimmedMessage, history);
  const { intent: classifiedIntent } = classifyIntent(intentMessage);

  if (isPreludeBusinessIntent(classifiedIntent)) {
    const business = buildPreludeBusinessAnswer({
      intent: classifiedIntent,
      message: trimmedMessage,
      profile
    });
    if (business?.text) {
      return normalizeChatResponse({
        text: business.text,
        actions: business.actions,
        provider: "prelude",
        model: "business",
        intent: classifiedIntent,
        sources: ["Prelude platform knowledge"]
      });
    }
  }

  let retrieval = { intent: classifiedIntent, blocks: [], sources: [], conversationState: {} };
  try {
    retrieval = retrieveContext(trimmedMessage, history);
    if (!retrieval.intent) retrieval.intent = classifiedIntent;
  } catch (error) {
    if (error instanceof DatabaseNotFoundError) {
      error.code = "DATABASE_NOT_FOUND";
      throw error;
    }
    throw error;
  }

  const intent = retrieval.intent ?? classifiedIntent;
  const conversationState = retrieval.conversationState ?? {};

  const preFallback = classifyPreLlmFallback({
    message: trimmedMessage,
    conversationHistory: history,
    retrieval,
    intent,
    conversationState
  });

  const sharedMeta = {
    intent,
    sources: uniqueSourceLabels(retrieval.sources),
    retrievedRecords: retrieval.blocks.flatMap((block) => block.records).slice(0, 12),
    conversationState
  };

  if (preFallback) {
    return normalizeChatResponse({ ...preFallback, ...sharedMeta });
  }

  if (isOffTopicMessage(trimmedMessage)) {
    const offTopic = buildStaticGuidanceAnswer(trimmedMessage);
    return normalizeChatResponse({
      text: offTopic,
      provider: "prelude",
      model: "guidance",
      ...sharedMeta
    });
  }

  const retrievalAnswer = buildRetrievalAssistedAnswer(trimmedMessage, retrieval, conversationState);
  if (retrievalAnswer && shouldPreferRetrievalAnswer(intent, retrieval)) {
    return normalizeChatResponse({
      text: retrievalAnswer,
      actions: [],
      provider: "prelude",
      model: "retrieval",
      ...sharedMeta
    });
  }

  const chatMessages = buildRagChatMessages({
    message: trimmedMessage,
    conversationHistory: history,
    retrieval,
    profile
  });

  const result = await callChatModel(chatMessages, resolvedConfig);

  let answerText = result.text;

  if (isLowQualityLlmAnswer(answerText)) {
    answerText =
      buildRetrievalAssistedAnswer(trimmedMessage, retrieval, conversationState) ??
      buildStaticGuidanceAnswer(trimmedMessage) ??
      buildMandatoryFallbackAnswer(trimmedMessage, conversationState);
  }

  const postFallback = classifyPostLlmFallback({
    text: answerText,
    retrieval,
    intent,
    message: trimmedMessage
  });

  if (postFallback) {
    return normalizeChatResponse({ ...postFallback, ...sharedMeta });
  }

  return normalizeChatResponse({
    ...result,
    text: answerText,
    ...sharedMeta
  });
}
