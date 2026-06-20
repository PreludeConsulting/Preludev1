import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendCollegesFromQuestionnaire } from "../../server/datasets/collegeRecommendations.js";

function questionnaireWith(overrides = {}) {
  const answers = Array.from({ length: 24 }, (_, index) => ({
    index,
    question: `Question ${index}`,
    answer: "Neutral"
  }));
  for (const [index, answer] of Object.entries(overrides)) {
    answers[Number(index)].answer = answer;
  }
  return { answers };
}

describe("college recommendations from questionnaire", () => {
  it("returns ranked recommendations with fit reasons", () => {
    const result = recommendCollegesFromQuestionnaire({
      profile: { targetMajors: ["computer science"], location: "GA" },
      questionnaire: questionnaireWith({
        8: "Agree",
        9: "Strongly agree",
        20: "Agree",
        22: "Agree",
        23: "Strongly agree"
      }),
      limit: 5
    });

    assert.equal(result.questionnaireRequired, false);
    assert.equal(result.preferences.major, "computer science");
    assert.ok(result.recommendations.length > 0);
    assert.ok(result.recommendations.length <= 5);
    assert.ok(result.recommendations.every((college) => Number.isInteger(college.score)));
    assert.ok(result.recommendations.some((college) => college.reasons.length > 0));
  });

  it("falls back to general recommendations without a completed questionnaire", () => {
    const result = recommendCollegesFromQuestionnaire({ profile: {}, questionnaire: null, limit: 3 });

    assert.equal(result.questionnaireRequired, true);
    assert.ok(result.recommendations.length > 0);
    assert.ok(result.recommendations.length <= 3);
  });

  it("keeps specialized engineering recommendations on the selected engineering field", () => {
    const result = recommendCollegesFromQuestionnaire({
      profile: { targetMajors: ["electrical engineering"] },
      questionnaire: questionnaireWith(),
      limit: 5
    });

    assert.ok(result.recommendations.length > 0);
    assert.ok(result.preferences.major.match(/electrical engineering/i));
    assert.ok(result.recommendations.every((college) => college.reasons.some((reason) => /electrical engineering/i.test(reason))));
  });
});
