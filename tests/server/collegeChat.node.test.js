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
