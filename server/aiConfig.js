import { isOpenAiKeyConfigured } from "./loadEnv.js";

export function getAiProvider(env = process.env) {
  const provider = String(env.AI_PROVIDER ?? "openai").trim().toLowerCase();
  return provider === "ollama" ? "ollama" : "openai";
}

export function buildChatModelConfig(env = process.env) {
  return {
    provider: getAiProvider(env),
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaModel: env.OLLAMA_MODEL ?? "gemma3"
  };
}

export function isChatAiConfigured(config = buildChatModelConfig()) {
  if (config.provider === "ollama") {
    return Boolean(String(config.ollamaModel ?? "").trim());
  }
  return isOpenAiKeyConfigured(config.openaiApiKey);
}

export function getAiStartupMessage(env = process.env) {
  const config = buildChatModelConfig(env);
  if (config.provider === "ollama") {
    return `AI provider: Ollama (${config.ollamaModel} @ ${config.ollamaBaseUrl}) — run "ollama serve" and "ollama pull ${config.ollamaModel}"`;
  }
  if (isOpenAiKeyConfigured(config.openaiApiKey)) {
    return `AI provider: OpenAI (${config.openaiModel})`;
  }
  return "AI provider: OpenAI — set OPENAI_API_KEY in .env for /api/chat";
}
