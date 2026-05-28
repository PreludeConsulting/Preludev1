import { describe, expect, it } from "vitest";
import { TRAINING_CASES } from "./fixtures.js";
import { classify, getRuleBasedReply } from "../../src/lib/preludeAgent.js";
import { evaluateResponse } from "../../src/lib/responseQuality.js";

describe("Prelude AI training cases (rule-based)", () => {
  for (const scenario of TRAINING_CASES) {
    it(`answers: ${scenario.id}`, () => {
      const category = classify(scenario.userMessage);
      expect(category).toBe(scenario.category);

      const reply = getRuleBasedReply(scenario.userMessage, []);
      const result = evaluateResponse(reply.text, {
        minWords: scenario.minWords,
        mustMatch: scenario.mustMatch,
        mustNotMatch: scenario.mustNotMatch,
        mustNotBeDeflectionOnly: scenario.mustNotBeDeflectionOnly,
        requireSubstance: true
      });

      if (!result.pass) {
        console.error(`\n[${scenario.id}] reply:\n${reply.text}\n`);
      }

      expect(result.pass, result.failures.join("; ")).toBe(true);
    });
  }
});

describe("response quality guards", () => {
  it("rejects deflection-only replies", () => {
    const bad =
      "That's exactly the kind of thing a Prelude mentor can help with in detail. I can help identify what support you need, but a mentor would be better for building a full personalized plan.";
    const result = evaluateResponse(bad, { mustNotBeDeflectionOnly: true });
    expect(result.pass).toBe(false);
  });

  it("accepts answer-first replies", () => {
    const reply = getRuleBasedReply("What is FAFSA?", []);
    const result = evaluateResponse(reply.text, {
      mustMatch: [/fafsa/i],
      minWords: 30,
      mustNotBeDeflectionOnly: true
    });
    expect(result.pass).toBe(true);
  });
});
