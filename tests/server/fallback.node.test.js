import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRagChatCompletion } from "../../server/chatHandler.js";
import {
  buildServiceErrorFallback,
  classifyPreLlmFallback,
  classifyPostLlmFallback
} from "../../server/rag/fallback.js";
import { classifyIntent } from "../../server/rag/intent.js";
import { retrieveContext } from "../../server/rag/retrieval.js";

describe("fallback classification", () => {
  it("returns insufficient_verified_information for unknown schools", () => {
    const message = "Where is Example Imaginary Academy located?";
    const retrieval = retrieveContext(message, []);
    const fallback = classifyPreLlmFallback({
      message,
      conversationHistory: [],
      retrieval,
      intent: classifyIntent(message).intent
    });

    assert.ok(fallback);
    assert.equal(fallback.fallback.reason, "insufficient_verified_information");
    assert.match(fallback.text, /could not find a verified record/i);
    assert.doesNotMatch(fallback.text, /Lawrenceville|Atlanta|Boston/i);
    assert.ok(fallback.fallback.actions.some((item) => item.action === "open_plans"));
    assert.ok(fallback.fallback.actions.some((item) => item.action === "open_mentor_match"));
  });

  it("returns needs_personalized_guidance for exact admission chances", () => {
    const message = "Tell me the exact percentage chance that I will get into Georgia Tech.";
    const fallback = classifyPreLlmFallback({
      message,
      conversationHistory: [],
      retrieval: { blocks: [], sources: [] },
      intent: classifyIntent(message).intent
    });

    assert.ok(fallback);
    assert.equal(fallback.fallback.reason, "needs_personalized_guidance");
    assert.match(fallback.text, /cannot give an exact admission percentage/i);
    assert.doesNotMatch(fallback.text, /\b\d{1,3}%\b/);
    assert.ok(fallback.fallback.actions.some((item) => item.action === "open_mentor_match"));
  });

  it("returns unsupported_request for full essay rewrite without writing the essay", () => {
    const message = "Rewrite my entire Common App essay and make it ready to submit.";
    const fallback = classifyPreLlmFallback({
      message,
      conversationHistory: [],
      retrieval: { blocks: [], sources: [] },
      intent: classifyIntent(message).intent
    });

    assert.ok(fallback);
    assert.equal(fallback.fallback.reason, "unsupported_request");
    assert.match(fallback.text, /should not rewrite an entire essay/i);
    assert.ok(fallback.text.length < 1200);
    assert.ok(fallback.fallback.actions.some((item) => item.action === "open_plans"));
  });

  it("does not fallback for normal Early Action vs Early Decision questions", () => {
    const message = "What is the difference between Early Action and Early Decision?";
    const fallback = classifyPreLlmFallback({
      message,
      conversationHistory: [],
      retrieval: retrieveContext(message, []),
      intent: classifyIntent(message).intent
    });

    assert.equal(fallback, null);
  });

  it("builds temporary_service_error fallback for upstream failures", () => {
    const error = new Error("Ollama request failed");
    error.code = "UPSTREAM_ERROR";
    const fallback = buildServiceErrorFallback(error);

    assert.ok(fallback);
    assert.equal(fallback.fallback.reason, "temporary_service_error");
    assert.match(fallback.text, /could not complete that request/i);
    assert.ok(fallback.fallback.actions.some((item) => item.action === "try_again"));
  });

  it("post-llm fallback replaces empty model output", () => {
    const fallback = classifyPostLlmFallback({
      text: "",
      retrieval: { blocks: [], sources: [] },
      intent: "general_admissions"
    });
    assert.equal(fallback.fallback.reason, "temporary_service_error");
  });
});

describe("createRagChatCompletion fallback integration", () => {
  it("short-circuits LLM for unknown school location questions", async () => {
    const result = await createRagChatCompletion({
      message: "Where is Example Imaginary Academy located?",
      conversationHistory: []
    });

    assert.equal(result.fallback?.type, "mentor_support");
    assert.equal(result.model, "fallback");
    assert.match(result.text, /verified record/i);
  });
});
