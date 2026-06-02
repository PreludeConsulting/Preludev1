import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChatModelConfig, getAiProvider, isChatAiConfigured } from "../../server/aiConfig.js";
import { assertChatConfigured } from "../../server/chatModel.js";
import { mapChatError } from "../../server/chatErrors.js";

describe("AI provider config", () => {
  it("defaults to openai", () => {
    assert.equal(getAiProvider({}), "openai");
  });

  it("uses ollama when AI_PROVIDER=ollama", () => {
    assert.equal(getAiProvider({ AI_PROVIDER: "ollama" }), "ollama");
    const config = buildChatModelConfig({ AI_PROVIDER: "ollama", OLLAMA_MODEL: "gemma3" });
    assert.equal(config.provider, "ollama");
    assert.equal(config.ollamaModel, "gemma3");
    assert.equal(isChatAiConfigured(config), true);
  });

  it("does not require OPENAI_API_KEY for ollama", () => {
    const config = buildChatModelConfig({ AI_PROVIDER: "ollama", OLLAMA_MODEL: "gemma3" });
    assert.doesNotThrow(() => assertChatConfigured(config));
  });

  it("requires OPENAI_API_KEY for openai", () => {
    const config = buildChatModelConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "" });
    assert.throws(() => assertChatConfigured(config), (error) => error.code === "NOT_CONFIGURED");
  });

  it("maps ollama errors to clear client messages", () => {
    const notRunning = mapChatError({
      code: "OLLAMA_NOT_RUNNING",
      message: 'Ollama is not running. Start it with "ollama serve", then try again.'
    });
    assert.equal(notRunning.status, 503);
    assert.match(notRunning.body.message, /ollama serve/i);

    const missingModel = mapChatError({
      code: "OLLAMA_MODEL_NOT_FOUND",
      message: 'Ollama model "gemma3" is not available. Run: ollama pull gemma3'
    });
    assert.equal(missingModel.status, 503);
    assert.match(missingModel.body.message, /ollama pull/i);
  });
});
