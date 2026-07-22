import { buildChatModelConfig } from "./aiConfig.js";
import { callChatModel } from "./chatModel.js";
import { DatabaseNotFoundError } from "./db/sqlite.js";
import {
  buildRetrievalQuery,
  sanitizeConversationHistory
} from "./rag/conversationHistory.js";
import {
  buildRagChatMessages,
  buildUntrustedProfileContext,
  loadPreludeInstructions,
  uniqueSourceLabels
} from "./rag/promptBuilder.js";
import { normalizeChatResponse } from "./chatResponse.js";
import {
  buildServiceErrorFallback,
  classifyPostLlmFallback,
  classifyPreLlmFallback
} from "./rag/fallback.js";
import { classifyIntent, isPreludeBusinessIntent } from "./rag/intent.js";
import { buildPreludeBusinessAnswer } from "./rag/preludeBusiness.js";
import { routeActiveConversation } from "./rag/intentRouter.js";
import { buildAdmissionsCopilotAnswer } from "./rag/admissionsCopilot.js";
import {
  CHAT_DISPATCH_ROUTES,
  dispatchGuardedChatRoute
} from "./rag/guardedDispatcher.js";
import { isGuaranteeRequest } from "./rag/guaranteeIntent.js";
import { retrieveContext } from "./rag/retrieval.js";
import { buildKnowledgeRetrieval } from "./rag/knowledgeRetrieval.js";
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

function mergeRetrieval(primary, secondary) {
  return {
    ...primary,
    blocks: [...(primary.blocks ?? []), ...(secondary.blocks ?? [])],
    sources: [...(primary.sources ?? []), ...(secondary.sources ?? [])]
  };
}

function dashboardKnowledgePolicy(message, dispatchRoute) {
  const explicitScholarshipIntent =
    /\b(scholarships?|merit aid|scholarship awards?|award opportunities|financial aid)\b/i.test(message);

  if (explicitScholarshipIntent) {
    return {
      enabled: true,
      sourceTypes: ["scholarship"],
      skipAdmissionsCopilot: true,
      retrievalIntent: "financial_aid"
    };
  }

  return {
    enabled: ![
      CHAT_DISPATCH_ROUTES.STRUCTURED_ADMISSIONS,
      CHAT_DISPATCH_ROUTES.RECOMMENDATION_OR_COMPARISON
    ].includes(dispatchRoute),
    sourceTypes: null,
    skipAdmissionsCopilot: false,
    retrievalIntent: null
  };
}

function buildLegacySystemPrompt() {
  const instructions = loadPreludeInstructions();
  return `${instructions.system}\n\n---\n\n## Reference knowledge\n\n${instructions.knowledge}`;
}

export async function createChatCompletion(messages, config = {}, profile = null) {
  const resolvedConfig = resolveConfig(config);

  if (!Array.isArray(messages) || messages.length === 0) {
    const error = new Error("messages must be a non-empty array");
    error.code = "BAD_REQUEST";
    throw error;
  }

  const systemPrompt = buildLegacySystemPrompt();
  const profileContext = buildUntrustedProfileContext(profile);
  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...(profileContext ? [{ role: "user", content: profileContext }] : []),
    ...messages
  ];

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
  const priorState =
    [...history]
      .reverse()
      .find((item) => item.conversationState && typeof item.conversationState === "object")?.conversationState ?? {};

  if (isGuaranteeRequest(trimmedMessage)) {
    return normalizeChatResponse({
      text:
        "I can’t predict or guarantee an admission outcome. Admissions depend on academics, course rigor, activities, essays, recommendations, fit, and the applicant pool. I can help you compare your profile with published benchmarks and build a balanced reach/target/likely list.",
      provider: "prelude",
      model: "guidance",
      intent: "guarantee_refusal",
      guidanceReason: "admissions_chances",
      actions: [],
      sources: [],
      sourceLabels: [],
      retrievedRecords: [],
      conversationState: priorState
    });
  }

  const dispatchRoute = dispatchGuardedChatRoute({
    message: trimmedMessage,
    conversationHistory: history,
    priorState
  });
  const knowledgePolicy = dashboardKnowledgePolicy(trimmedMessage, dispatchRoute);

  let activeFlow = null;
  if (
    dispatchRoute === CHAT_DISPATCH_ROUTES.CONVERSATION_FOLLOW_UP ||
    dispatchRoute === CHAT_DISPATCH_ROUTES.SCHOOL_SPECIFIC
  ) {
    try {
      activeFlow = routeActiveConversation({
        message: trimmedMessage,
        conversationHistory: history
      });
    } catch (error) {
      if (!(error instanceof DatabaseNotFoundError)) {
        throw error;
      }
    }
  }

  if (activeFlow) {
    return normalizeChatResponse(activeFlow);
  }

  const useAdmissionsCopilot =
    dispatchRoute === CHAT_DISPATCH_ROUTES.GENERAL && !knowledgePolicy.skipAdmissionsCopilot;
  const copilotAnswer = useAdmissionsCopilot
    ? await buildAdmissionsCopilotAnswer({
        message: trimmedMessage,
        conversationHistory: history,
        profile,
        priorState
      })
    : null;
  if (copilotAnswer?.text) {
    return normalizeChatResponse({
      ...copilotAnswer,
      answer: copilotAnswer.text,
      sources: copilotAnswer.sourceLabels ?? copilotAnswer.sources ?? []
    });
  }

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
  if (knowledgePolicy.retrievalIntent) {
    retrieval = {
      intent: knowledgePolicy.retrievalIntent,
      blocks: [],
      sources: [],
      conversationState: priorState
    };
  } else {
    try {
      retrieval = retrieveContext(trimmedMessage, history);
    } catch (error) {
      if (!(error instanceof DatabaseNotFoundError)) {
        throw error;
      }
      retrieval = { intent: classifiedIntent, blocks: [], sources: [], conversationState: {} };
    }
  }

  try {
    if (!retrieval.intent) retrieval.intent = classifiedIntent;
    if (knowledgePolicy.enabled) {
      const knowledgeRetrieval = await buildKnowledgeRetrieval(trimmedMessage, {
        limit: 8,
        profile,
        sourceTypes: knowledgePolicy.sourceTypes
      });
      retrieval = mergeRetrieval(retrieval, knowledgeRetrieval);
    }
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
    sourceLabels: uniqueSourceLabels(retrieval.sources),
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

  let result = null;
  try {
    result = await callChatModel(chatMessages, resolvedConfig);
  } catch (error) {
    const serviceFallback = buildServiceErrorFallback(error);
    if (serviceFallback) {
      return normalizeChatResponse({ ...serviceFallback, ...sharedMeta });
    }
    throw error;
  }

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
