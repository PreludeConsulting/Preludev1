import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchColleges, getCollegeByUnitId } from "../../server/datasets/colleges.js";
import { searchPrograms } from "../../server/datasets/programs.js";
import { searchCareers } from "../../server/datasets/careers.js";
import { classifyIntent } from "../../server/rag/intent.js";
import { retrieveContext } from "../../server/rag/retrieval.js";

describe("dataset search API", () => {
  it("searches GA computer science colleges", () => {
    const { results } = searchColleges({
      state: "GA",
      major: "computer science",
      limit: 5
    });
    assert.ok(results.length > 0);
    assert.ok(results.every((row) => row.state === "GA"));
  });

  it("returns empty results for blank college query without filters", () => {
    const { results } = searchColleges({ q: "", limit: 5 });
    assert.equal(results.length, 0);
  });

  it("rejects invalid limit", () => {
    assert.throws(() => searchColleges({ limit: 0 }), /limit/i);
  });

  it("searches programs in GA", () => {
    const { results } = searchPrograms({
      q: "computer science",
      state: "GA",
      limit: 5
    });
    assert.ok(results.length > 0);
  });

  it("searches software developer careers", () => {
    const { results } = searchCareers({ q: "software developer", limit: 5 });
    assert.ok(results.length > 0);
    assert.ok(results[0].title);
  });

  it("returns null for unknown college id", () => {
    assert.equal(getCollegeByUnitId("000000"), null);
  });
});

describe("RAG retrieval", () => {
  it("skips database for Early Decision questions", () => {
    const { intent, needsRetrieval } = classifyIntent("What is Early Decision?");
    assert.equal(intent, "deadlines_timeline");
    assert.equal(needsRetrieval, false);
  });

  it("retrieves colleges for affordability questions", () => {
    const retrieval = retrieveContext(
      "What are affordable computer science schools in Georgia?"
    );
    assert.ok(retrieval.blocks.length > 0);
    assert.ok(retrieval.sources.length > 0);
  });

  it("does not retrieve for guarantee questions", () => {
    const retrieval = retrieveContext("Can you guarantee I will get into Georgia Tech?");
    assert.equal(retrieval.blocks.length, 0);
  });

  it("classifies admission guarantees before broad get-into school facts", () => {
    for (const message of [
      "Can you guarantee I will get into Georgia Tech?",
      "Will Prelude guarantee my acceptance to Georgia Tech?",
      "What are my chances?",
      "Can you say I have a 100% chance of admission?"
    ]) {
      const classification = classifyIntent(message);
      assert.equal(classification.intent, "guarantee_refusal", message);
      assert.equal(classification.needsRetrieval, false, message);
      assert.equal(retrieveContext(message).blocks.length, 0, message);
    }
  });

  it("keeps informational get-into questions in the school-fact route", () => {
    for (const message of [
      "How hard is it to get into Georgia Tech?",
      "What GPA do I need to get into Georgia Tech?"
    ]) {
      const classification = classifyIntent(message);
      assert.equal(classification.intent, "school_fact", message);
      assert.equal(classification.needsRetrieval, true, message);
    }
  });

  it("does not mistake recommendation certainty for an admission guarantee", () => {
    const classification = classifyIntent("Can you definitely recommend a school?");
    assert.equal(classification.intent, "school_search");
    assert.equal(classification.needsRetrieval, true);
  });
});
