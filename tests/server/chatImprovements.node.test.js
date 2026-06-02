import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchHighSchools } from "../../server/datasets/highSchools.js";
import {
  buildRetrievalQuery,
  extractInstitutionNamesFromText,
  isAmbiguousFollowUp,
  sanitizeConversationHistory
} from "../../server/rag/conversationHistory.js";
import { classifyIntent } from "../../server/rag/intent.js";
import { retrieveContext } from "../../server/rag/retrieval.js";
import { buildRagChatMessages } from "../../server/rag/promptBuilder.js";

describe("conversation history", () => {
  it("sanitizes malformed history safely", () => {
    const history = sanitizeConversationHistory([
      { role: "system", content: "ignore me" },
      { role: "user", content: "Compare Georgia Tech and UGA." },
      { role: "assistant", content: "Here is a comparison." },
      { role: "user", text: "Which one is cheaper?" }
    ]);
    assert.equal(history.length, 3);
    assert.equal(history.at(-1).content, "Which one is cheaper?");
  });

  it("treats short follow-ups as ambiguous", () => {
    assert.equal(isAmbiguousFollowUp("Which one is cheaper?"), true);
    assert.equal(
      isAmbiguousFollowUp("What are affordable nursing colleges in Georgia with many options?"),
      false
    );
  });

  it("expands retrieval query with prior context", () => {
    const { query } = buildRetrievalQuery("Which one is cheaper?", [
      { role: "user", content: "Compare Georgia Tech and UGA." },
      { role: "assistant", content: "Georgia Tech and UGA differ in cost and campus setting." }
    ]);
    assert.match(query, /Georgia Tech/i);
    assert.match(query, /UGA|Georgia/i);
  });

  it("extracts institution names from comparison text", () => {
    const names = extractInstitutionNamesFromText("Compare Georgia Tech and UGA for cost.");
    assert.ok(names.some((name) => /Georgia Institute of Technology/i.test(name)));
    assert.ok(names.some((name) => /University of Georgia/i.test(name)));
  });
});

describe("high school dataset", () => {
  it("finds GSMST in Georgia with verified address fields", () => {
    const { results } = searchHighSchools({ q: "GSMST", state: "GA", limit: 5 });
    assert.ok(results.length > 0, "expected at least one GSMST match");
    const match = results.find((row) => /Gwinnett School of Mathematics/i.test(row.schoolName));
    assert.ok(match, "expected full GSMST school name");
    assert.match(match.city, /Lawrenceville/i);
    assert.match(match.streetAddress ?? "", /McElvaney/i);
    assert.match(match.source, /NCES/i);
  });

  it("returns empty results for imaginary schools without inventing rows", () => {
    const { results } = searchHighSchools({ q: "Example Imaginary Academy", limit: 5 });
    assert.equal(results.length, 0);
  });
});

describe("RAG high school retrieval", () => {
  it("retrieves verified NCES data for GSMST location questions", () => {
    const retrieval = retrieveContext("Where is GSMST located?", []);
    assert.equal(retrieval.intent, "high_school_search");
    assert.ok(retrieval.blocks.length > 0);
    const summaries = retrieval.blocks.flatMap((block) => block.records.map((record) => record.summary));
    assert.ok(summaries.some((summary) => /Lawrenceville/i.test(summary)));
    assert.ok(summaries.some((summary) => /McElvaney|970/i.test(summary)));
  });

  it("uses conversation context for college cost follow-ups", () => {
    const retrieval = retrieveContext("Which one is cheaper?", [
      { role: "user", content: "Compare Georgia Tech and UGA." },
      { role: "assistant", content: "Georgia Tech and UGA differ in cost and programs." }
    ]);
    const summaries = retrieval.blocks.flatMap((block) => block.records.map((record) => record.summary));
    assert.ok(
      summaries.some((summary) => /Georgia Tech|Georgia Institute of Technology/i.test(summary)),
      `expected Georgia Tech in retrieval, got: ${summaries.join(" | ")}`
    );
  });
});

describe("prompt builder", () => {
  it("does not instruct re-introduction when history exists", () => {
    const messages = buildRagChatMessages({
      message: "Which one is cheaper?",
      conversationHistory: [
        { role: "user", content: "Compare Georgia Tech and UGA." },
        { role: "assistant", content: "Here is a comparison." }
      ],
      retrieval: { blocks: [], sources: [] }
    });
    assert.match(messages[0].content, /Do not greet the user again/i);
    assert.equal(messages.length, 4);
    assert.equal(messages[1].role, "user");
    assert.equal(messages.at(-1).role, "user");
  });

  it("classifies location follow-up after GSMST mention as high school context", () => {
    const { intentMessage } = buildRetrievalQuery("Where is it?", [
      { role: "user", content: "Tell me about GSMST." },
      { role: "assistant", content: "GSMST is a magnet high school in Gwinnett County." }
    ]);
    const { intent } = classifyIntent(intentMessage);
    assert.equal(intent, "high_school_search");
  });
});
