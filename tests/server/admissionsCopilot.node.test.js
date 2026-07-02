import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRagChatCompletion } from "../../server/chatHandler.js";
import { classifyAdmissionsIntent } from "../../server/rag/admissionsIntentRouter.js";
import { normalizeForIntentDetection } from "../../server/rag/inputNormalize.js";
import { lookupUniversityInText, lookupUniversityByName } from "../../server/rag/universityLookup.js";
import { buildAdmissionsCopilotAnswer } from "../../server/rag/admissionsCopilot.js";
import { ADMISSIONS_INTENT_CATEGORIES } from "../../server/rag/admissionsIntents.js";
import { tryBuildSchoolAnswer } from "../../server/rag/handlers/schoolHandler.js";

describe("input normalization and typo tolerance", () => {
  it("corrects common school and intent typos", () => {
    const normalized = normalizeForIntentDetection("what sat avrg for havard");
    assert.match(normalized.text, /harvard/);
    assert.match(normalized.text, /sat average/);
  });

  it("resolves havard and harverd to Harvard University", () => {
    const havard = lookupUniversityByName("havard");
    const harverd = lookupUniversityByName("harverd");
    assert.equal(havard.metadata.name, "Harvard University");
    assert.equal(harverd.metadata.name, "Harvard University");
  });

  it("resolves georiga tech typo", () => {
    const gt = lookupUniversityByName("georiga tech");
    assert.ok(gt);
    assert.match(gt.metadata.name, /Georgia Institute of Technology/i);
  });
});

describe("admissions intent router", () => {
  it("routes typo school SAT question to school fact", () => {
    const result = classifyAdmissionsIntent("what is havards average sat");
    assert.equal(result.intentCategory, ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT);
    assert.equal(result.entities.school.metadata.name, "Harvard University");
  });

  it("routes scholarship typo to scholarships intent", () => {
    const result = classifyAdmissionsIntent("find scholorships for stem");
    assert.equal(result.intentCategory, ADMISSIONS_INTENT_CATEGORIES.SCHOLARSHIPS);
    assert.ok(result.entities.interests.includes("STEM"));
  });

  it("routes summer program typo", () => {
    const result = classifyAdmissionsIntent("summer progrms for comp sci");
    assert.equal(result.intentCategory, ADMISSIONS_INTENT_CATEGORIES.SUMMER_PROGRAMS);
  });

  it("routes extracurricular typo", () => {
    const result = classifyAdmissionsIntent("help improve my extracuriculars");
    assert.equal(result.intentCategory, ADMISSIONS_INTENT_CATEGORIES.EXTRACURRICULARS);
  });

  it("routes college list typo", () => {
    const result = classifyAdmissionsIntent("what colledges fit my gpa");
    assert.equal(result.intentCategory, ADMISSIONS_INTENT_CATEGORIES.COLLEGE_SEARCH);
  });

  it("routes essay typo", () => {
    const result = classifyAdmissionsIntent("how do i make common app essay beter");
    assert.equal(result.intentCategory, ADMISSIONS_INTENT_CATEGORIES.ESSAYS);
  });

  it("routes financial aid typo for brown", () => {
    const result = classifyAdmissionsIntent("finacial aid for brown");
    assert.equal(result.intentCategory, ADMISSIONS_INTENT_CATEGORIES.FINANCIAL_AID);
    assert.equal(result.entities.school.metadata.name, "Brown University");
  });
});

describe("admissions copilot answers", () => {
  it("answers havard SAT average from database", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "what is havards average sat"
    });
    assert.ok(answer);
    assert.match(answer.text, /1553/);
    assert.match(answer.text, /Harvard University/);
  });

  it("answers harverd SAT benchmark with disclaimer", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "what sat do i need for harverd"
    });
    assert.ok(answer);
    assert.match(answer.text, /Harvard University/);
    assert.match(answer.text, /1553/);
    assert.match(answer.text, /can't guarantee|cannot guarantee|does not guarantee/i);
  });

  it("returns scholarship matches for STEM typo query", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "find scholorships for stem"
    });
    assert.ok(answer);
    assert.match(answer.text, /Prelude|scholarship/i);
  });

  it("returns summer program matches for biology", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "suggest summer programs for biology"
    });
    assert.ok(answer);
    assert.match(answer.text, /summer|program|Prelude/i);
  });

  it("returns college list for CS in California", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "Build me a college list for CS in California.",
      profile: { gpa: 3.8, sat: 1450, majors: ["computer science"] }
    });
    assert.ok(answer);
    assert.match(answer.text, /reach|target|likely/i);
  });

  it("returns essay guidance", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "Help me brainstorm my Common App essay."
    });
    assert.ok(answer);
    assert.match(answer.text, /essay|brainstorm|authentic/i);
  });

  it("returns application strategy guidance for ED question", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "Should I apply ED?"
    });
    assert.ok(answer);
    assert.match(answer.text, /early decision|early action/i);
  });

  it("handles georiga tech acceptance rate typo", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "georiga tech acceptance rate"
    });
    assert.ok(answer);
    assert.match(answer.text, /Georgia Institute of Technology/i);
    assert.match(answer.text, /admission rate|acceptance/i);
  });

  it("handles upen tuition typo", async () => {
    const answer = await buildAdmissionsCopilotAnswer({
      message: "upen tuition"
    });
    assert.ok(answer);
    assert.match(answer.text, /University of Pennsylvania/i);
    assert.match(answer.text, /tuition|cost/i);
  });
});

describe("conversation memory follow-ups", () => {
  it("uses Harvard for admission rate follow-up", () => {
    const history = [
      { role: "user", content: "What is the average SAT score in Harvard?" },
      { role: "assistant", content: "Harvard University's average SAT score is 1553." }
    ];
    const answer = tryBuildSchoolAnswer({
      message: "What is the admission rate?",
      conversationHistory: history
    });
    assert.ok(answer);
    assert.match(answer.text, /Harvard University/);
    assert.match(answer.text, /admission rate/i);
  });

  it("uses Harvard for cost follow-up typo", () => {
    const history = [
      { role: "user", content: "what sat do i need for harverd" },
      { role: "assistant", content: "Harvard University average SAT is 1553." }
    ];
    const answer = tryBuildSchoolAnswer({
      message: "What about cost?",
      conversationHistory: history
    });
    assert.ok(answer);
    assert.match(answer.text, /Harvard University/);
    assert.match(answer.text, /cost|tuition/i);
  });
});

describe("chat completion integration", () => {
  it("returns Harvard SAT via createRagChatCompletion with typo", async () => {
    const result = await createRagChatCompletion({
      message: "what is havards average sat",
      conversationHistory: []
    });
    assert.match(result.answer, /1553/);
    assert.match(result.answer, /Harvard University/);
  });

  it("returns deferral guidance", async () => {
    const result = await createRagChatCompletion({
      message: "I got deferred. What should I do?",
      conversationHistory: []
    });
    assert.ok(result.answer.length > 40);
  });
});
