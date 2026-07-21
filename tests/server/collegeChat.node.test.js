import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCollegeAlias, resolveCollegesFromText } from "../../server/datasets/collegeAliases.js";
import { deriveConversationState } from "../../server/rag/conversationState.js";
import { parseCorrection } from "../../server/rag/corrections.js";
import { createRagChatCompletion } from "../../server/chatHandler.js";
import { retrieveContext } from "../../server/rag/retrieval.js";
import { buildRetrievalAssistedAnswer } from "../../server/rag/retrievalAnswer.js";
import { searchPrograms } from "../../server/datasets/programs.js";
import { searchColleges } from "../../server/datasets/colleges.js";
import {
  CHAT_DISPATCH_ROUTES,
  dispatchGuardedChatFacts,
  dispatchGuardedChatRoute
} from "../../server/rag/guardedDispatcher.js";

describe("guarded chat dispatcher", () => {
  it("returns every public route and preserves routing precedence from plain facts", () => {
    const route = (overrides = {}) =>
      dispatchGuardedChatFacts({
        safety: false,
        activeEssayFollowUp: false,
        structuredFinancial: false,
        comparisonOrCorrection: false,
        explicitHighConfidenceSchoolCount: 0,
        supportedSchoolFact: false,
        persistedSchoolFollowUp: false,
        needsSchoolClarification: false,
        structuredOverview: false,
        structuredSearchContext: false,
        recommendation: false,
        comparisonContext: false,
        ...overrides
      });

    assert.equal(
      route({ safety: true, activeEssayFollowUp: true, structuredFinancial: true }),
      CHAT_DISPATCH_ROUTES.SAFETY
    );
    assert.equal(
      route({ activeEssayFollowUp: true, explicitHighConfidenceSchoolCount: 1, supportedSchoolFact: true }),
      CHAT_DISPATCH_ROUTES.CONVERSATION_FOLLOW_UP
    );
    assert.equal(
      route({ explicitHighConfidenceSchoolCount: 1, supportedSchoolFact: true }),
      CHAT_DISPATCH_ROUTES.SCHOOL_SPECIFIC
    );
    assert.equal(
      route({
        comparisonOrCorrection: true,
        explicitHighConfidenceSchoolCount: 1,
        supportedSchoolFact: true
      }),
      CHAT_DISPATCH_ROUTES.RECOMMENDATION_OR_COMPARISON
    );
    assert.equal(
      route({ structuredFinancial: true, comparisonContext: true, persistedSchoolFollowUp: true }),
      CHAT_DISPATCH_ROUTES.STRUCTURED_ADMISSIONS
    );
    assert.equal(
      route({ structuredOverview: true, persistedSchoolFollowUp: true }),
      CHAT_DISPATCH_ROUTES.STRUCTURED_ADMISSIONS
    );
    assert.equal(
      route({ structuredSearchContext: true }),
      CHAT_DISPATCH_ROUTES.STRUCTURED_ADMISSIONS
    );
    assert.equal(
      route({ recommendation: true }),
      CHAT_DISPATCH_ROUTES.RECOMMENDATION_OR_COMPARISON
    );
    assert.equal(route(), CHAT_DISPATCH_ROUTES.GENERAL);
  });

  it("routes a factual correction as comparison rather than a single-school fact", () => {
    assert.equal(
      dispatchGuardedChatRoute({
        message: "I said Georgia Tech, not UGA. What is the acceptance rate?",
        conversationHistory: []
      }),
      CHAT_DISPATCH_ROUTES.RECOMMENDATION_OR_COMPARISON
    );
  });
});

describe("college alias resolution", () => {
  it("resolves GT and UCLA without confusing UGA", () => {
    const gt = resolveCollegeAlias("GT");
    const ucla = resolveCollegeAlias("UCLA");
    const uga = resolveCollegeAlias("UGA");

    assert.match(gt.canonicalName, /Georgia Institute of Technology/i);
    assert.equal(gt.unitid, "139755");
    assert.match(ucla.canonicalName, /California-Los Angeles/i);
    assert.equal(ucla.unitid, "110662");
    assert.match(uga.canonicalName, /University of Georgia/i);
    assert.notEqual(ucla.unitid, uga.unitid);

    const gsu = resolveCollegeAlias("GSU");
    assert.match(gsu.canonicalName, /Georgia State University/i);
    assert.equal(gsu.unitid, "139940");
  });

  it("does not resolve a state-only answer as a random college", () => {
    const schools = resolveCollegesFromText("Georgia, electrical engineering, cost matters");
    assert.equal(schools.length, 0);
  });

  it("extracts both schools from UCLA vs GT question", () => {
    const schools = resolveCollegesFromText("which is better for cs UCLA or GT");
    assert.equal(schools.length, 2);
    const names = schools.map((school) => school.canonicalName).join(" ");
    assert.match(names, /California-Los Angeles/i);
    assert.match(names, /Georgia Institute of Technology/i);
    assert.doesNotMatch(names, /University of Georgia/i);
  });
});

describe("conversation state and corrections", () => {
  it("preserves GA, CS, and program strength across messages", () => {
    const state = deriveConversationState("ga 10k", [
      { role: "user", content: "ga, cs, program strength" },
      { role: "assistant", content: "Got it." }
    ]);
    assert.equal(state.state, "GA");
    assert.equal(state.intendedMajor, "computer science");
    assert.equal(state.priority, "program strength");
    assert.equal(state.budget, 10000);
  });

  it("extracts a verified school mentioned by the assistant", () => {
    const state = deriveConversationState("Georgia state university", [
      {
        role: "assistant",
        content:
          "I found verified data for **Wiregrass Georgia Technical College**, but I could not match a second school from your question."
      }
    ]);
    const names = state.schoolsUnderDiscussion.map((school) => school.canonicalName).join(" ");
    assert.match(names, /Wiregrass Georgia Technical College/i);
    assert.match(names, /Georgia State University/i);
  });

  it("applies UCLA correction and keeps GT from history", () => {
    const baseState = deriveConversationState("which is better for cs UCLA or GT", []);
    const correction = parseCorrection("i said ucla not uga", baseState);
    assert.ok(correction?.isCorrection);
    const names = correction.schoolsUnderDiscussion.map((school) => school.canonicalName).join(" ");
    assert.match(names, /California-Los Angeles/i);
    assert.match(names, /Georgia Institute of Technology/i);
    assert.doesNotMatch(names, /University of Georgia/i);
  });
});

describe("UCLA vs GT chat flows", () => {
  it("retrieves both colleges for comparison", () => {
    const retrieval = retrieveContext("which is better for cs UCLA or GT", []);
    const colleges = retrieval.blocks.flatMap((block) => block.records).filter((r) => r.type === "college");
    assert.equal(colleges.length, 2);
    const summaries = colleges.map((record) => record.summary).join(" ");
    assert.match(summaries, /California-Los Angeles/i);
    assert.match(summaries, /Georgia Institute of Technology/i);
  });

  it("comparison answer mentions UCLA and GT, not UGA", () => {
    const retrieval = retrieveContext("which is better for cs UCLA or GT", []);
    const answer = buildRetrievalAssistedAnswer("which is better for cs UCLA or GT", retrieval, retrieval.conversationState);
    assert.ok(answer);
    assert.match(answer, /California-Los Angeles|UCLA/i);
    assert.match(answer, /Georgia Institute of Technology|Georgia Tech/i);
    assert.doesNotMatch(answer, /University of Georgia|\bUGA\b/i);
  });

  it("handles cheaper follow-up using prior schools", async () => {
    const result = await createRagChatCompletion({
      message: "which is cheaper?",
      conversationHistory: [
        { role: "user", content: "which is better for cs UCLA or GT" },
        { role: "assistant", content: "UCLA and Georgia Tech are both strong options for CS." }
      ]
    });
    assert.match(result.answer, /California-Los Angeles|UCLA/i);
    assert.match(result.answer, /Georgia Institute of Technology|Georgia Tech/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });

  it("handles correction without intake restart", async () => {
    const result = await createRagChatCompletion({
      message: "i said ucla not uga",
      conversationHistory: [
        { role: "user", content: "which is better for cs UCLA or GT" },
        { role: "assistant", content: "Georgia Tech and UGA are both strong options." }
      ]
    });
    assert.match(result.answer, /California-Los Angeles|UCLA/i);
    assert.doesNotMatch(result.answer, /University of Georgia · Athens/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });


  it("keeps school comparison context for cheaper options follow-up", async () => {
    const result = await createRagChatCompletion({
      message: "cheaper options",
      conversationHistory: [
        { role: "user", content: "Compare Georgia Tech and UGA for electrical engineering" },
        { role: "assistant", content: "Georgia Tech and UGA are both Georgia options for engineering." }
      ]
    });

    assert.match(result.answer, /Georgia Institute of Technology|Georgia Tech/i);
    assert.match(result.answer, /University of Georgia|UGA/i);
    assert.match(result.answer, /cost|net price|cheaper|affordable/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });

  it("uses prior state major and cost context for a Georgia Tech school info request", async () => {
    const result = await createRagChatCompletion({
      message: "I want to go to georgia tech",
      conversationHistory: [
        { role: "user", content: "Georgia, Electrical engineering, cost matters" }
      ]
    });

    assert.match(result.answer, /Georgia Institute of Technology|Georgia Tech/i);
    assert.match(result.answer, /electrical engineering/i);
    assert.match(result.answer, /cost matters|in-state tuition|lower-cost backup|net price/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });

  it("answers a Georgia Tech more-info request without generic fallback", async () => {
    const result = await createRagChatCompletion({
      message: "Tell me a bit more about georgia tech",
      conversationHistory: []
    });

    assert.match(result.answer, /Georgia Institute of Technology|Georgia Tech/i);
    assert.match(result.answer, /public research university|engineering|computer science|applied sciences/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });

  it("compares Wiregrass with Georgia State when the user supplies the second school", async () => {
    const result = await createRagChatCompletion({
      message: "Georgia state university",
      conversationHistory: [
        { role: "user", content: "I need help with essays" },
        {
          role: "assistant",
          content:
            "I want to give you a useful answer rather than a vague reply. Tell me your state, intended major, and whether cost or program strength matters more."
        },
        { role: "user", content: "Georgia, electrical engineering, cost matters" },
        {
          role: "assistant",
          content:
            "I found verified data for **Wiregrass Georgia Technical College**, but I could not match a second school from your question. Tell me the other college name and I will compare them."
        }
      ]
    });

    assert.match(result.answer, /Wiregrass Georgia Technical College/i);
    assert.match(result.answer, /Georgia State University/i);
    assert.match(result.answer, /electrical engineering technology|transfer pathway/i);
    assert.match(result.answer, /Source: College Scorecard/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
  });

  it("answers a corrected Georgia State follow-up without restarting intake", async () => {
    const result = await createRagChatCompletion({
      message: "Georgia state university",
      conversationHistory: [
        { role: "user", content: "I need help with essays" },
        {
          role: "assistant",
          content:
            "I want to give you a useful answer rather than a vague reply. Tell me your state, intended major, and whether cost or program strength matters more."
        },
        { role: "user", content: "Georgia, electrical engineering, cost matters" },
        {
          role: "assistant",
          content:
            "Here are verified Georgia colleges with electrical engineering programs, prioritizing cost."
        }
      ]
    });

    assert.match(result.answer, /Georgia State University/i);
    assert.match(result.answer, /Source: College Scorecard/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
    assert.doesNotMatch(result.answer, /Wiregrass/i);
  });

  it("returns GA CS colleges for budget follow-up", async () => {
    const result = await createRagChatCompletion({
      message: "ga 10k",
      conversationHistory: [
        { role: "user", content: "ga, cs, program strength" },
        { role: "assistant", content: "Got it. You are looking for Georgia colleges for computer science." }
      ]
    });
    assert.match(result.answer, /computer science|Computer Science/i);
    assert.doesNotMatch(result.answer, /Tell me your state, intended major/i);
    assert.doesNotMatch(result.answer, /astronomy|classics|maintenance/i);
  });

  it("keeps College Scorecard colleges authoritative for a GA CS budget follow-up", async () => {
    const result = await createRagChatCompletion({
      message: "ga 10k",
      conversationHistory: [
        { role: "user", content: "ga, cs, program strength" },
        { role: "assistant", content: "Got it. You are looking for Georgia colleges for computer science." }
      ]
    });

    const [primaryRecord] = result.retrievedRecords;
    assert.equal(primaryRecord?.type, "college");
    assert.match(primaryRecord?.source ?? "", /College Scorecard/i);
    assert.match(result.sourceLabels[0] ?? "", /College Scorecard/i);
    assert.match(result.answer, /College Scorecard/i);
  });

  it("uses College Scorecard data as the primary source for Georgia Tech cost", async () => {
    const result = await createRagChatCompletion({
      message: "How much does Georgia Tech cost?",
      conversationHistory: []
    });

    assert.match(result.answer, /Georgia Institute of Technology|Georgia Tech/i);
    const [primaryRecord] = result.retrievedRecords;
    assert.equal(primaryRecord?.type, "college");
    assert.match(primaryRecord?.source ?? "", /College Scorecard/i);
    assert.match(result.sourceLabels[0] ?? "", /College Scorecard/i);
    assert.match(result.answer, /College Scorecard/i);
  });
});

describe("program and college major filters", () => {
  it("returns only CS-related programs in GA", () => {
    const { results } = searchPrograms({ q: "computer science", state: "GA", limit: 10 });
    assert.ok(results.length > 0);
    for (const row of results) {
      assert.match(row.programDescription, /computer science/i);
    }
  });

  it("returns GA colleges with CS programs only", () => {
    const { results } = searchColleges({ state: "GA", major: "computer science", limit: 10 });
    assert.ok(results.length > 0);
    assert.ok(results.every((row) => row.state === "GA"));
  });
});
