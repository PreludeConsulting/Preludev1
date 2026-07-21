import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRagChatCompletion } from "../../server/chatHandler.js";
import {
  listUniversities,
  lookupUniversitiesInText,
  lookupUniversityInText,
  lookupUniversityByName
} from "../../server/rag/universityLookup.js";
import { deriveSchoolConversationContext } from "../../server/rag/schoolConversation.js";
import { tryBuildSchoolAnswer } from "../../server/rag/handlers/schoolHandler.js";

describe("university lookup", () => {
  it("resolves Harvard from shorthand and full name", () => {
    const harvard = lookupUniversityInText("What is the average SAT score in Harvard?");
    assert.ok(harvard);
    assert.equal(harvard.metadata.name, "Harvard University");
    assert.equal(harvard.metadata.satAverage, 1553);
  });

  it("resolves aliases like Georgia Tech and UPenn", () => {
    const gt = lookupUniversityByName("Georgia Tech");
    assert.ok(gt);
    assert.match(gt.metadata.name, /Georgia Institute of Technology/i);

    const upenn = lookupUniversityByName("UPenn");
    assert.ok(upenn);
    assert.equal(upenn.metadata.name, "University of Pennsylvania");
  });

  it("resolves explicit Georgia Tech names and aliases inside natural language", () => {
    for (const message of [
      "Georgia Tech",
      "Georgia Institute of Technology-Main Campus",
      "GT",
      "Tell me about Georgia Tech",
      "More about Georgia Tech"
    ]) {
      const result = lookupUniversityInText(message);
      assert.ok(result, message);
      assert.match(result.metadata.name, /Georgia Institute of Technology/i, message);
    }
  });

  it("does not infer a university from conversational or generic school text", () => {
    const messages = [
      "yes",
      "no",
      "ok",
      "what is the best school for cs",
      "school university college institute tech campus"
    ];

    assert.deepEqual(
      messages.map((message) => lookupUniversityInText(message)?.metadata.name ?? null),
      messages.map(() => null)
    );
  });

  it("returns every explicitly named university in text occurrence order", () => {
    const results = lookupUniversitiesInText(
      "Compare Georgia Tech, Harvard University, and UCLA"
    );

    assert.deepEqual(
      results.map((record) => record.metadata.name),
      [
        "Georgia Institute of Technology-Main Campus",
        "Harvard University",
        "University of California-Los Angeles"
      ]
    );
  });

  it("accepts a strict multi-token fuzzy match for a real university name", () => {
    const canonical = listUniversities().find(
      (record) => record.title === "Kennesaw State University"
    );
    assert.ok(canonical);

    const result = lookupUniversityByName("Kennessaw State University");
    assert.ok(result);
    assert.equal(result.id, canonical.id);
    assert.match(result.matchMethod, /^fuzzy_/);
    assert.ok(result.matchScore >= 0.88, `matchScore was ${result.matchScore}`);
  });

  it("rejects generic near-matches and long whole-sentence fuzzy input", () => {
    assert.equal(
      lookupUniversityByName("universty institue technolgy campus"),
      null
    );

    const longSentence =
      "please can you tell me whether kennessaw state university is a good fit for my planned computer science degree next fall";
    assert.ok(longSentence.split(/\s+/).length > 16);
    assert.equal(lookupUniversityByName(longSentence), null);
  });

  it("rejects a multi-token fuzzy name below the per-token threshold", () => {
    assert.equal(lookupUniversityByName("Kenesaw Stete University"), null);
  });

  it("rejects a zero-margin fuzzy match between real Northwest Technical schools", () => {
    const candidates = listUniversities()
      .filter((record) =>
        ["Northwest Technical Institute", "Northwest Technical College"].includes(
          record.title
        )
      )
      .map((record) => record.title)
      .sort();

    assert.deepEqual(candidates, [
      "Northwest Technical College",
      "Northwest Technical Institute"
    ]);
    assert.equal(lookupUniversityByName("Northwest Technical University"), null);
  });

  it("rejects ambiguous standalone input while extracting both explicit schools from text", () => {
    const input = "Georgia Tech and Harvard University";
    assert.equal(lookupUniversityByName(input), null);
    assert.deepEqual(
      lookupUniversitiesInText(input).map((record) => record.metadata.name),
      ["Georgia Institute of Technology-Main Campus", "Harvard University"]
    );
  });

  it("preserves the canonical GT record and exposes exact alias match metadata", () => {
    const canonical = listUniversities().find(
      (record) => record.title === "Georgia Institute of Technology-Main Campus"
    );
    assert.ok(canonical);

    const result = lookupUniversityByName("GT");
    assert.ok(result);
    assert.equal(result.id, canonical.id);
    assert.equal(result.title, canonical.title);
    assert.deepEqual(result.metadata, canonical.metadata);
    assert.equal(result.matchMethod, "exact_alias");
    assert.equal(result.matchScore, 1);
    assert.equal(result.matchConfidence, "high");
  });
});

describe("school conversation context", () => {
  it("detects factual SAT question for Harvard", () => {
    const ctx = deriveSchoolConversationContext("What is the average SAT score in Harvard?");
    assert.equal(ctx.questionIntent, "school_fact");
    assert.equal(ctx.school.metadata.name, "Harvard University");
    assert.equal(ctx.topic, "sat_average");
  });

  it("connects school-only follow-up to prior SAT question", () => {
    const history = [
      { role: "user", content: "What do I need on the SAT?" },
      {
        role: "assistant",
        content: "I can answer that SAT question using the Prelude University Database. Which school are you asking about?"
      }
    ];
    const ctx = deriveSchoolConversationContext("Harvard University", history);
    assert.equal(ctx.school.metadata.name, "Harvard University");
    assert.match(ctx.topic, /sat/);
    assert.equal(ctx.continuedFromPrior, true);
  });

  it("uses last school for admission rate follow-up", () => {
    const history = [
      { role: "user", content: "What is the average SAT score in Harvard?" },
      {
        role: "assistant",
        content: "According to the Prelude University Database, Harvard University's average SAT score is 1553."
      }
    ];
    const ctx = deriveSchoolConversationContext("What is the admission rate?", history);
    assert.equal(ctx.school.metadata.name, "Harvard University");
    assert.equal(ctx.topic, "admission_rate");
  });
});

describe("school fact answers", () => {
  it("answers Harvard SAT average directly", () => {
    const answer = tryBuildSchoolAnswer({
      message: "What is the average SAT score in Harvard?"
    });
    assert.ok(answer);
    assert.match(answer.text, /1553/);
    assert.match(answer.text, /Harvard University/);
    assert.match(answer.text, /Prelude University Database/);
    assert.doesNotMatch(answer.text, /Which school are you asking about/i);
    assert.equal(answer.retrievedRecords[0].metadata.name, "Harvard University");
  });

  it("answers SAT benchmark question with disclaimer plus data", () => {
    const answer = tryBuildSchoolAnswer({
      message: "What do I need on the SAT to get into Harvard?"
    });
    assert.ok(answer);
    assert.match(answer.text, /1553/);
    assert.match(answer.text, /can't guarantee|cannot guarantee|does not guarantee/i);
    assert.doesNotMatch(answer.text, /Which school are you asking about/i);
  });

  it("answers school follow-up after clarification", () => {
    const history = [
      { role: "user", content: "What do I need on the SAT?" },
      {
        role: "assistant",
        content: "I can answer that SAT question using the Prelude University Database. Which school are you asking about?"
      }
    ];
    const answer = tryBuildSchoolAnswer({
      message: "Harvard University",
      conversationHistory: history
    });
    assert.ok(answer);
    assert.match(answer.text, /Harvard University/);
    assert.match(answer.text, /1553/);
  });
});

describe("school facts via chat completion", () => {
  it("returns Harvard SAT average for factual question", async () => {
    const result = await createRagChatCompletion({
      message: "What is the average SAT score in Harvard?",
      conversationHistory: []
    });
    assert.match(result.answer, /1553/);
    assert.match(result.answer, /Harvard University/);
    assert.ok(result.retrievedRecords.some((record) => record.metadata?.name === "Harvard University"));
  });

  it("handles SAT benchmark question without generic refusal", async () => {
    const result = await createRagChatCompletion({
      message: "What do I need on the SAT to get into Harvard?",
      conversationHistory: []
    });
    assert.match(result.answer, /Harvard University/);
    assert.match(result.answer, /1553/);
    assert.doesNotMatch(result.answer, /Which school are you asking about/i);
  });

  it("answers cost follow-up when Harvard was discussed earlier", () => {
    const history = [
      { role: "user", content: "What is the average SAT score in Harvard?" },
      { role: "assistant", content: "Harvard University's average SAT score is 1553." }
    ];
    const answer = tryBuildSchoolAnswer({
      message: "What about cost?",
      conversationHistory: history
    });
    assert.ok(answer);
    assert.match(answer.text, /Harvard University/);
    assert.match(answer.text, /\$85,540|85540|cost/i);
  });
});
