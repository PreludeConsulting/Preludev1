import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDashboardKnowledgeRows } from "../../scripts/lib/knowledgeIngest.js";
import {
  buildKnowledgeRetrieval,
  profileMissingForQuestion,
  retrieveKnowledgeChunks
} from "../../server/rag/knowledgeRetrieval.js";
import { createRagChatCompletion } from "../../server/chatHandler.js";

describe("Prelude dashboard knowledge ingestion", () => {
  it("builds structured rows for all dashboard CSV sources", () => {
    const rows = buildDashboardKnowledgeRows();
    const types = new Set(rows.map((row) => row.sourceType));
    assert.ok(types.has("university"));
    assert.ok(types.has("scholarship"));
    assert.ok(types.has("summer_program"));
    assert.ok(types.has("extracurricular"));
    assert.ok(types.has("cs_project"));
    assert.ok(rows.length > 100);
  });

  it("stores university metadata with admission and cost fields", () => {
    const rows = buildDashboardKnowledgeRows();
    const auburn = rows.find((row) => row.title === "Auburn University");
    assert.ok(auburn);
    assert.equal(auburn.metadata.state, "AL");
    assert.ok(auburn.metadata.admissionRate != null);
    assert.ok(auburn.metadata.satAverage != null);
  });
});

describe("Prelude dashboard knowledge retrieval", () => {
  it("retrieves universities by state and SAT context", async () => {
    const rows = await retrieveKnowledgeChunks("colleges in Georgia with SAT around 1300", {
      limit: 6,
      profile: { sat: 1300, location: "GA" }
    });
    assert.ok(rows.some((row) => row.sourceType === "university"));
    assert.ok(rows.some((row) => /georgia|atlanta|GA/i.test(row.searchableText ?? row.content)));
  });

  it("retrieves scholarships with award and deadline fields", async () => {
    const rows = await retrieveKnowledgeChunks("scholarships for high school seniors with leadership", { limit: 6 });
    assert.ok(rows.some((row) => row.sourceType === "scholarship"));
    assert.ok(rows.some((row) => /award|deadline/i.test(row.content)));
  });

  it("retrieves summer programs by selectivity", async () => {
    const rows = await retrieveKnowledgeChunks("highly selective summer STEM programs", { limit: 6 });
    assert.ok(rows.some((row) => row.sourceType === "summer_program"));
  });

  it("retrieves extracurricular activities with leadership roles", async () => {
    const rows = await retrieveKnowledgeChunks("extracurricular activities for leadership and public speaking", { limit: 6 });
    assert.ok(rows.some((row) => row.sourceType === "extracurricular"));
  });

  it("retrieves CS project ideas by difficulty and impact", async () => {
    const rows = await retrieveKnowledgeChunks("advanced CS project ideas with high impact", {
      limit: 6,
      profile: { majors: ["Computer Science"] }
    });
    assert.ok(rows.some((row) => row.sourceType === "cs_project"));
  });

  it("groups dashboard records in retrieval blocks with metadata", async () => {
    const retrieval = await buildKnowledgeRetrieval("What scholarships fit me?", { limit: 4 });
    const records = retrieval.blocks.flatMap((block) => block.records);
    assert.ok(records.some((record) => record.sourceType === "scholarship"));
    assert.ok(records.some((record) => record.metadata));
  });
});

describe("Prelude dashboard AI guardrails", () => {
  it("flags missing profile fields for college list questions", () => {
    const missing = profileMissingForQuestion("Build my college list with reach target and safety schools", {});
    assert.ok(missing.includes("SAT or ACT score"));
  });

  it("returns source labels for scholarship retrieval answers", async () => {
    const result = await createRagChatCompletion({
      message: "What scholarships fit a high school senior with leadership for college tuition?",
      conversationHistory: []
    });
    assert.ok(Array.isArray(result.sourceLabels));
    assert.equal(result.retrievedRecords[0]?.sourceType, "scholarship");
    assert.ok(result.retrievedRecords.length > 0);
    assert.ok(result.retrievedRecords.every((record) => record.sourceType === "scholarship"));
    assert.ok(result.sourceLabels.length > 0);
    assert.match(result.answer, /scholarship|award/i);
  });

  it("keeps scholarship records available for explicit financial-aid requests", async () => {
    const result = await createRagChatCompletion({
      message: "Show me financial aid opportunities from the Prelude database.",
      conversationHistory: []
    });

    assert.equal(result.retrievedRecords[0]?.sourceType, "scholarship");
    assert.ok(result.sourceLabels.length > 0);
  });

  it("does not fabricate a fake scholarship name in retrieval-first answers", async () => {
    const result = await createRagChatCompletion({
      message: "Recommend scholarships from the Prelude database only.",
      conversationHistory: []
    });
    assert.doesNotMatch(result.answer, /Imaginary Scholarship Foundation|Totally Fake Award/i);
  });
});
