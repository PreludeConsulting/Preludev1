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


  it("returns essay mentor_referral with mentor-plan CTA metadata", () => {
    const fallback = classifyPreLlmFallback({
      message: "help me with essays",
      conversationHistory: [],
      retrieval: { blocks: [], sources: [] },
      intent: classifyIntent("help me with essays").intent
    });

    assert.ok(fallback);
    assert.equal(fallback.type, "mentor_referral");
    assert.equal(fallback.responseType, "mentor_referral");
    assert.equal(fallback.category, "essay");
    assert.equal(fallback.ctaLabel, "View mentor plans");
    assert.equal(fallback.ctaTarget, "#pricing");
    assert.match(fallback.text, /Essay support|mentor plans/i);
    assert.ok(fallback.actions.some((item) => item.label === "View mentor plans" && item.href === "#pricing"));
  });

  it("returns mentor_referral for personalized strategy-heavy requests", () => {
    for (const message of [
      "Help me write my essay about moving schools",
      "Can you make my Common App essay?",
      "Help me create a plan for my future",
      "What should I do with my life?",
      "Tell me what major I should choose",
      "Make my application strategy",
      "Can you review my essay?",
      "Help me pick extracurriculars"
    ]) {
      const fallback = classifyPreLlmFallback({
        message,
        conversationHistory: [],
        retrieval: { blocks: [], sources: [] },
        intent: classifyIntent(message).intent
      });

      assert.ok(fallback, message);
      assert.equal(fallback.responseType, "mentor_referral");
      assert.equal(fallback.model, "mentor_referral");
      assert.match(fallback.text, /mentor/i);
    }
  });

  it("routes unclear, college-list, and financial-aid fallback messages by intent", () => {
    const cases = [
      ["asdf", "general_unclear", /didn’t fully understand/i],
      ["what colleges should I apply to", "college_list", /state, intended major/i],
      ["I need scholarships", "financial_aid", /scholarships|FAFSA|college costs/i]
    ];

    for (const [message, category, pattern] of cases) {
      const fallback = classifyPreLlmFallback({
        message,
        conversationHistory: [],
        retrieval: { blocks: [], sources: [] },
        intent: classifyIntent(message).intent
      });

      assert.ok(fallback, message);
      assert.equal(fallback.responseType, "intent_fallback");
      assert.equal(fallback.category, category);
      assert.match(fallback.text, pattern);
    }
  });

  it("does not mentor-refer simple essay or process explanation questions", () => {
    for (const message of [
      "what is the common app essay",
      "What is the difference between Early Action and Early Decision?"
    ]) {
      const fallback = classifyPreLlmFallback({
        message,
        conversationHistory: [],
        retrieval: { blocks: [], sources: [] },
        intent: classifyIntent(message).intent
      });

      assert.equal(fallback, null);
    }
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

  it("returns contextual essay help without generic intake", async () => {
    const result = await createRagChatCompletion({
      message: "I need help with essays",
      conversationHistory: []
    });

    assert.equal(result.model, "guidance");
    assert.match(result.answer, /Common App essay|supplementals|topic ideas/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });

  it("returns contextual admission chances guidance without generic intake", async () => {
    const result = await createRagChatCompletion({
      message: "What are my chances?",
      conversationHistory: []
    });

    assert.equal(result.model, "guidance");
    assert.match(result.answer, /can’t predict|reach\/target\/likely/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });

  it("continues essay mode when the user says scratch variants", async () => {
    const baseHistory = [
      { role: "user", content: "I need help with essays" },
      {
        role: "assistant",
        content:
          "Absolutely — I can help with your Common App essay, supplementals, topic ideas, outlines, or editing. Are you starting from scratch or revising a draft?"
      }
    ];

    for (const message of ["scratch", "starting from scratch", "from scratch", "new essay", "I haven't started"]) {
      const result = await createRagChatCompletion({ message, conversationHistory: baseHistory });

      assert.equal(result.model, "flow");
      assert.match(result.answer, /start from scratch|strong topic|experience|challenge|interest/i);
      assert.doesNotMatch(result.answer, /Absolutely — I can help with your Common App essay/i);
      assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
    }
  });

  it("continues essay mode when the user says draft variants", async () => {
    const baseHistory = [
      { role: "user", content: "I need help with essays" },
      {
        role: "assistant",
        content:
          "Absolutely — I can help with your Common App essay, supplementals, topic ideas, outlines, or editing. Are you starting from scratch or revising a draft?"
      }
    ];

    for (const message of ["revising", "draft", "I have a draft"]) {
      const result = await createRagChatCompletion({ message, conversationHistory: baseHistory });

      assert.equal(result.model, "flow");
      assert.match(result.answer, /paste the draft|structure|voice/i);
      assert.doesNotMatch(result.answer, /starting from scratch or revising a draft/i);
    }
  });

  it("keeps yes and no replies inside essay mode", async () => {
    const baseHistory = [
      { role: "user", content: "I need help with essays" },
      {
        role: "assistant",
        content:
          "Absolutely — I can help with your Common App essay, supplementals, topic ideas, outlines, or editing. Are you starting from scratch or revising a draft?"
      }
    ];

    const yesResult = await createRagChatCompletion({
      message: "yes",
      conversationHistory: baseHistory
    });
    assert.equal(yesResult.model, "flow");
    assert.match(yesResult.answer, /scratch.*draft|draft.*scratch/i);
    assert.doesNotMatch(yesResult.answer, /Tell me your state, intended major/i);

    const noResult = await createRagChatCompletion({
      message: "no",
      conversationHistory: baseHistory
    });
    assert.equal(noResult.model, "flow");
    assert.match(noResult.answer, /brainstorming|activity|challenge|interest/i);
    assert.doesNotMatch(noResult.answer, /Tell me your state, intended major/i);
  });

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
