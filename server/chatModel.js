import { buildChatModelConfig, getAiProvider, isChatAiConfigured } from "./aiConfig.js";
import { callOllama } from "./ollamaClient.js";
import { callOpenAi } from "./openaiClient.js";
import { isOpenAiKeyConfigured } from "./loadEnv.js";

export function assertChatConfigured(config = buildChatModelConfig()) {
  const provider = config.provider ?? getAiProvider();

  if (provider === "ollama") {
    if (!isChatAiConfigured(config)) {
      const error = new Error("OLLAMA_MODEL is not set");
      error.code = "NOT_CONFIGURED";
      throw error;
    }
    return config;
  }

  const apiKey = config.openaiApiKey;
  if (!isOpenAiKeyConfigured(apiKey)) {
    const error = new Error("OPENAI_API_KEY is not set");
    error.code = "NOT_CONFIGURED";
    throw error;
  }

  return config;
}

export async function callChatModel(chatMessages, config = buildChatModelConfig()) {
  const resolved = assertChatConfigured(config);

  if (resolved.provider === "ollama") {
    return callOllama(chatMessages, {
      baseUrl: resolved.ollamaBaseUrl,
      model: resolved.ollamaModel
    });
  }

  return callOpenAi(chatMessages, {
    apiKey: resolved.openaiApiKey,
    model: resolved.openaiModel ?? "gpt-4o-mini"
  });
}
