import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRagChatCompletion } from "../../server/chatHandler.js";
import {
  buildRetrievalAssistedAnswer,
  isLowQualityLlmAnswer
} from "../../server/rag/retrievalAnswer.js";
import { retrieveContext } from "../../server/rag/retrieval.js";

describe("LLM answer quality", () => {
  it("detects stub acknowledgements", () => {
    assert.equal(isLowQualityLlmAnswer("Okay"), true);
    assert.equal(isLowQualityLlmAnswer("That"), true);
    assert.equal(isLowQualityLlmAnswer("**"), true);
    assert.equal(isLowQualityLlmAnswer("Georgia Tech and UGA differ in CS strength and campus setting."), false);
  });

  it("returns retrieval-first answer for best CS school question", async () => {
    const result = await createRagChatCompletion({
      message: "what is the best school for cs",
      conversationHistory: []
    });
    assert.ok(result.answer.length > 100);
    assert.doesNotMatch(result.answer, /^(okay|that|\*\*)$/i);
    assert.match(result.answer, /computer science|College Scorecard|depends/i);
  });

  it("redirects off-topic gaming messages", async () => {
    const result = await createRagChatCompletion({
      message: "i love brawl stars",
      conversationHistory: []
    });
    assert.match(result.answer, /college planning/i);
    assert.doesNotMatch(result.answer, /^that$/i);
  });

  it("builds comparison answer from retrieval when needed", () => {
    const retrieval = retrieveContext("hey, is gt or uga better for cs", []);
    const answer = buildRetrievalAssistedAnswer("hey, is gt or uga better for cs", retrieval);
    assert.ok(answer);
    assert.match(answer, /Georgia Tech|Georgia Institute of Technology/i);
    assert.match(answer, /UGA|University of Georgia/i);
  });

  it("returns substantive answer for GT vs UGA chat request", async () => {
    const result = await createRagChatCompletion({
      message: "hey, is gt or uga better for cs",
      conversationHistory: []
    });
    assert.ok(result.answer.length > 80);
    assert.doesNotMatch(result.answer, /^okay[.!]?$/i);
    assert.match(result.answer, /Georgia Tech|cost|campus|CS|computing/i);
  });

  it("returns useful guidance for getting started without menu-only stub", async () => {
    const result = await createRagChatCompletion({
      message: "I don't know where to start",
      conversationHistory: []
    });
    assert.ok(result.answer.length > 60);
    assert.doesNotMatch(result.answer, /^okay[.!]?$/i);
  });
});
