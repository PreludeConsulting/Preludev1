import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRagChatCompletion } from "../../server/chatHandler.js";
import { lookupUniversityInText, lookupUniversityByName } from "../../server/rag/universityLookup.js";
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
