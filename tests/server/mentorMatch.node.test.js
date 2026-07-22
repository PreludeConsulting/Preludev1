import assert from "node:assert/strict";
import { describe, it } from "node:test";
import chatApiHandler from "../../api/chat.js";
import {
  buildMentorMatchMessages,
  createMentorMatch,
  isCompletedMentorQuestionnaire
} from "../../server/mentorMatch.js";

function questionnaireFor(interest) {
  return {
    completed: true,
    answers: {
      academicInterests: [interest],
      mentorQualities: ["Structured step-by-step guidance"],
      structureScale: 5
    }
  };
}

async function invokeChatApi(body) {
  let statusCode = 0;
  let responseBody = null;
  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(response) {
      responseBody = response;
    }
  };

  await chatApiHandler({ method: "POST", body }, res);
  return { statusCode, responseBody };
}

describe("Prelude mentor matching", () => {
  it("accepts completed questionnaires for any academic interest", () => {
    for (const interest of ["Engineering", "Business", "Biology", "Undecided or exploring"]) {
      assert.equal(isCompletedMentorQuestionnaire(questionnaireFor(interest)), true);
    }
    assert.equal(isCompletedMentorQuestionnaire({ ...questionnaireFor("Engineering"), completed: false }), false);
    assert.equal(isCompletedMentorQuestionnaire({ completed: true, answers: {} }), false);
  });

  it("builds a constrained mentor-recommendation prompt", () => {
    const messages = buildMentorMatchMessages(questionnaireFor("Business"));
    assert.match(messages[0].content, /mentor matching only/i);
    assert.match(messages[0].content, /Do not invent named mentors/i);
    assert.match(messages[0].content, /Do not write or revise essays/i);
    assert.match(messages[0].content, /Do not mention pricing unless/i);
    assert.match(messages[1].content, /Business/);
  });

  it("calls the model after any eligible completed questionnaire", async () => {
    for (const interest of ["Engineering", "Business", "Biology", "Undecided or exploring"]) {
      let calls = 0;
      const result = await createMentorMatch(questionnaireFor(interest), {}, async () => {
        calls += 1;
        return { text: `Look for support aligned with ${interest}.`, provider: "test", model: "stub" };
      });
      assert.equal(calls, 1);
      assert.match(result.summary, new RegExp(interest.split(" ")[0], "i"));
    }
  });

  it("rejects incomplete questionnaires before calling the model", async () => {
    let calls = 0;
    await assert.rejects(
      () => createMentorMatch({ completed: false, answers: { academicInterests: ["Engineering"] } }, {}, async () => {
        calls += 1;
      }),
      /completed mentor questionnaire/i
    );
    assert.equal(calls, 0);
  });

  it("accepts a non-empty admissions guidance message", async () => {
    const { statusCode, responseBody } = await invokeChatApi({ message: "I need help with essays" });

    assert.equal(statusCode, 200);
    assert.equal(responseBody.answer, responseBody.text);
    assert.equal(responseBody.provider, "prelude");
    assert.equal(responseBody.model, "guidance");
    assert.ok(Array.isArray(responseBody.sources));
    assert.ok(Array.isArray(responseBody.actions));
    assert.match(responseBody.answer, /Common App essay|supplementals|topic ideas|outlines|editing/i);
  });

  it("rejects missing, blank, and unsupported chat bodies", async () => {
    for (const body of [{}, { message: "   " }, { message: { text: "Help with my essay" } }]) {
      const { statusCode, responseBody } = await invokeChatApi(body);

      assert.equal(statusCode, 400);
      assert.equal(responseBody.error, "invalid_chat_request");
      assert.match(responseBody.message, /mentorMatch payload|message string/i);
    }
  });

  it("rejects oversized AI prompts before retrieval or model work", async () => {
    const { statusCode, responseBody } = await invokeChatApi({ message: "x".repeat(8_001) });

    assert.equal(statusCode, 413);
    assert.equal(responseBody.error, "chat_request_too_large");
  });
});
