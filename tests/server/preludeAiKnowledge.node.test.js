import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildKnowledgeRetrieval } from "../../server/rag/knowledgeRetrieval.js";
import { createRagChatCompletion } from "../../server/chatHandler.js";

describe("Prelude AI verified knowledge retrieval", () => {
  it("retrieves strategy docs for CS summer program question", async () => {
    const retrieval = await buildKnowledgeRetrieval("What summer programs would strengthen my CS profile?");
    const text = retrieval.blocks.flatMap((block) => block.records.map((record) => record.summary)).join(" ");
    assert.match(text, /summer programs?|CS profile|portfolio|project/i);
  });

  it("retrieves no-fabrication admissions guidance for Stanford ask", async () => {
    const retrieval = await buildKnowledgeRetrieval("What do I need to get into Stanford?");
    const text = retrieval.blocks.flatMap((block) => block.records.map((record) => record.summary)).join(" ");
    assert.match(text, /avoid fabricating|verified|do not invent/i);
  });

  it("retrieves SAT submission policy guidance", async () => {
    const retrieval = await buildKnowledgeRetrieval("Should I submit my SAT score?");
    const text = retrieval.blocks.flatMap((block) => block.records.map((record) => record.summary)).join(" ");
    assert.match(text, /sat|test-policy|verified/i);
  });

  it("retrieves FAFSA verified source guidance", async () => {
    const retrieval = await buildKnowledgeRetrieval("What does FAFSA do?");
    const labels = retrieval.sources.map((entry) => entry.label).join(" ");
    assert.match(labels, /Federal Student Aid|Student Aid/i);
  });

  it("retrieves college comparison policy for Georgia Tech vs UGA", async () => {
    const retrieval = await buildKnowledgeRetrieval("Compare Georgia Tech and UGA for CS.");
    const labels = retrieval.sources.map((entry) => entry.label).join(" ");
    assert.match(labels, /College Scorecard|IPEDS/i);
  });

  it("retrieves O*NET/BLS context for CS major career outcomes", async () => {
    const retrieval = await buildKnowledgeRetrieval("What can I do with a CS major?");
    const labels = retrieval.sources.map((entry) => entry.label).join(" ");
    assert.match(labels, /O\*NET|BLS|Occupational Outlook/i);
  });
});

describe("Prelude AI response metadata + non-hallucination guard", () => {
  it("returns source labels in metadata for FAFSA question", async () => {
    const result = await createRagChatCompletion({
      message: "What does FAFSA do?",
      conversationHistory: []
    });
    assert.ok(Array.isArray(result.sourceLabels));
    assert.ok(result.sourceLabels.length > 0);
  });

  it("does not fabricate exact Stanford stats when not retrieved", async () => {
    const result = await createRagChatCompletion({
      message: "What do I need to get into Stanford?",
      conversationHistory: []
    });
    assert.doesNotMatch(result.answer, /\b\d{1,2}\.\d%\b|\b\d{1,2}% acceptance\b/i);
  });
});
