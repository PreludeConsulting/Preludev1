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

describe("Prelude AI local essay flow", () => {
  const essayHistory = [
    { role: "user", text: "I need help with essays" },
    {
      role: "assistant",
      text:
        "Absolutely — I can help with your Common App essay, supplementals, topic ideas, outlines, or editing. Are you starting from scratch or revising a draft?"
    }
  ];

  it("keeps a scratch follow-up in essay brainstorming instead of generic college-list intake", () => {
    const reply = getRuleBasedReply("Starting from scratch", essayHistory);

    expect(reply.category).toBe("essay");
    expect(reply.text).toMatch(/topic discovery|experience|personal value/i);
    expect(reply.text).not.toMatch(/state, intended major|college list/i);
  });

  it.each(["scratch", "Starting from scratch", "from scratch", "new essay", "I haven't started"])(
    "interprets %s as starting a new essay from prior assistant context",
    (userReply) => {
      const reply = getRuleBasedReply(userReply, essayHistory);

      expect(reply.category).toBe("essay");
      expect(reply.text).toMatch(/start from scratch|strong topic|experience|challenge|interest/i);
      expect(reply.text).not.toMatch(/state, intended major|college list/i);
    }
  );

  it.each(["revising", "draft", "I have a draft"])(
    "interprets %s as essay revision from prior assistant context",
    (userReply) => {
      const reply = getRuleBasedReply(userReply, essayHistory);

      expect(reply.category).toBe("essay");
      expect(reply.text).toMatch(/paste the draft|structure|voice/i);
      expect(reply.text).not.toMatch(/state, intended major|college list/i);
    }
  );

  it("does not force essay flow when the user clearly starts a new topic", () => {
    const reply = getRuleBasedReply("scholarships", essayHistory);

    expect(reply.category).toBe("financial");
    expect(reply.text).toMatch(/scholarships|fafsa|aid/i);
  });
});

describe("Prelude AI intent routing", () => {
  it("routes essay help to a mentor referral with mentor-plan CTA metadata", () => {
    const reply = getRuleBasedReply("help me with essays", []);

    expect(reply.responseType).toBe("mentor_referral");
    expect(reply.category).toBe("essay");
    expect(reply.ctaLabel).toBe("View mentor plans");
    expect(reply.ctaTarget).toBe("#pricing");
    expect(reply.text).toMatch(/Essay support|Prelude mentor|mentor plans/i);
    expect(reply.actions?.[0]).toMatchObject({ label: "View mentor plans", href: "#pricing" });
  });

  it.each([
    "Help me write my essay about moving schools",
    "Can you make my Common App essay?",
    "Help me create a plan for my future",
    "What should I do with my life?",
    "Tell me what major I should choose",
    "Make my application strategy",
    "Can you review my essay?",
    "Help me pick extracurriculars"
  ])("refers personalized request to a mentor: %s", (userMessage) => {
    const reply = getRuleBasedReply(userMessage, []);

    expect(reply.responseType).toBe("mentor_referral");
    expect(reply.text).toMatch(/mentor/i);
  });

  it("keeps simple essay explanation questions in normal AI help", () => {
    const reply = getRuleBasedReply("what is the common app essay", []);

    expect(reply.responseType).not.toBe("mentor_referral");
    expect(reply.text).toMatch(/personal statement|common app/i);
    expect(reply.actions).toBeUndefined();
  });

  it("uses the general unclear fallback for unrecognized messages", () => {
    const reply = getRuleBasedReply("asdf", []);

    expect(reply.responseType).toBe("intent_fallback");
    expect(reply.category).toBe("general_unclear");
    expect(reply.text).toMatch(/didn’t fully understand/i);
  });

  it("uses the college-list fallback only for college selection requests", () => {
    const reply = getRuleBasedReply("what colleges should I apply to", []);

    expect(reply.responseType).toBe("intent_fallback");
    expect(reply.category).toBe("college_list");
    expect(reply.text).toMatch(/state, intended major.*cost or program strength/i);
  });

  it("uses the financial-aid fallback for money questions", () => {
    const reply = getRuleBasedReply("I need scholarships", []);

    expect(reply.responseType).toBe("intent_fallback");
    expect(reply.category).toBe("financial_aid");
    expect(reply.text).toMatch(/scholarships|FAFSA|college costs/i);
  });
});
