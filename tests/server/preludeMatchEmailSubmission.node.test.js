/**
 * Prelude Match email-only submission helpers (no DB / Storage).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PRELUDE_MATCH_QUESTIONS } from "../../shared/preludeMatchQuestions.js";
import { EXPLORE_COLLEGE_CATALOG } from "../../shared/exploreCollegesCatalog.js";
import {
  PRELUDE_MATCH_FORM_VERSION,
  STILL_EXPLORING_LABEL,
  buildPreludeMatchEmail,
  buildPreludeMatchPayload,
  escapeHtml,
  serializeCollegesAnswer,
  validatePreludeMatchPayload
} from "../../shared/preludeMatchSubmission.js";

function baseAnswers(overrides = {}) {
  return {
    grade: "11th grade",
    processStage: ["Building my college list"],
    helpAreas: ["Choosing colleges", "Essay brainstorming"],
    academicInterests: ["Computer science"],
    colleges: [{ id: "harvard", name: "Harvard University", city: "Cambridge", state: "MA" }],
    mentorQualities: ["Structured step-by-step guidance"],
    structureScale: 3,
    biggestQuestion: "Is my profile strong enough?",
    accomplishFirst: ["Build my college list"],
    essayStage: ["I have a few ideas"],
    stemGuidance: ["Choosing STEM programs"],
    ...overrides
  };
}

function validPayload(overrides = {}) {
  const answers = baseAnswers(overrides.answerOverrides);
  const payload = buildPreludeMatchPayload({
    answers,
    submissionId: "11111111-1111-4111-8111-111111111111",
    studentDisplayName: "Ada Lovelace",
    timezone: "America/New_York",
    submittedAt: "2026-08-03T00:00:00.000Z",
    questions: PRELUDE_MATCH_QUESTIONS
  });
  return { ...payload, ...overrides };
}

test("shared catalog has the approved 85 colleges", () => {
  assert.equal(EXPLORE_COLLEGE_CATALOG.length, 85);
  assert.equal(EXPLORE_COLLEGE_CATALOG[0].id, "mit");
  assert.equal(EXPLORE_COLLEGE_CATALOG.at(-1).id, "georgia-state");
});

test("payload includes answers from every current question id when provided", () => {
  const payload = validPayload();
  for (const question of PRELUDE_MATCH_QUESTIONS) {
    if (question.id === "colleges") {
      assert.equal(payload.answers.colleges.stillExploring, false);
      assert.deepEqual(payload.answers.colleges.collegeIds, ["harvard"]);
      continue;
    }
    // Adaptive questions may be absent; required base ones must exist in baseAnswers
    if (!question.showWhen) {
      assert.notEqual(payload.answers[question.id], undefined, question.id);
    }
  }
  assert.equal(payload.formVersion, PRELUDE_MATCH_FORM_VERSION);
});

test("email includes exact question labels and student identity from verified auth fields", () => {
  const payload = validPayload();
  const email = buildPreludeMatchEmail({
    payload,
    questionDefs: PRELUDE_MATCH_QUESTIONS,
    verifiedUserId: "auth-user-1",
    verifiedEmail: "student@example.com",
    notificationEmail: "prelude@preludeconsultingllc.com"
  });
  assert.match(email.subject, /Ada Lovelace/);
  assert.match(email.text, /Authenticated email: student@example.com/);
  assert.match(email.text, /Authenticated Supabase user ID: auth-user-1/);
  assert.match(email.html, /auth-user-1/);
  for (const question of PRELUDE_MATCH_QUESTIONS) {
    assert.ok(email.text.includes(question.question), question.id);
    assert.ok(email.html.includes(escapeHtml(question.question)), question.id);
  }
  assert.match(email.text, /Harvard University/);
  assert.match(email.text, /Cambridge, MA/);
  assert.match(email.html, /Internal recipient: prelude@preludeconsultingllc.com/);
});

test("browser-provided identity fields are not required for email identity", () => {
  const payload = validPayload({ studentDisplayName: "Fake Name" });
  const email = buildPreludeMatchEmail({
    payload: { ...payload, userId: "browser-fake", authenticatedEmail: "fake@example.com" },
    questionDefs: PRELUDE_MATCH_QUESTIONS,
    verifiedUserId: "real-user",
    verifiedEmail: "real@example.com",
    notificationEmail: "prelude@preludeconsultingllc.com"
  });
  assert.match(email.text, /real-user/);
  assert.match(email.text, /real@example.com/);
  assert.doesNotMatch(email.text, /browser-fake/);
  assert.doesNotMatch(email.text, /fake@example.com/);
});

test("validation rejects invalid payloads, unknown colleges, and still-exploring conflicts", () => {
  assert.equal(validatePreludeMatchPayload({}, PRELUDE_MATCH_QUESTIONS).status, 400);
  assert.equal(validatePreludeMatchPayload(validPayload({ formVersion: "nope" }), PRELUDE_MATCH_QUESTIONS).ok, false);

  const unknown = validPayload();
  unknown.answers.colleges = { stillExploring: false, collegeIds: ["not-a-college"] };
  assert.equal(validatePreludeMatchPayload(unknown, PRELUDE_MATCH_QUESTIONS).ok, false);

  const conflict = validPayload();
  conflict.answers.colleges = { stillExploring: true, collegeIds: ["harvard"] };
  assert.equal(validatePreludeMatchPayload(conflict, PRELUDE_MATCH_QUESTIONS).ok, false);

  const dupes = validPayload();
  dupes.answers.colleges = { stillExploring: false, collegeIds: ["harvard", "harvard"] };
  assert.equal(validatePreludeMatchPayload(dupes, PRELUDE_MATCH_QUESTIONS).ok, false);

  const exploring = validPayload({
    answerOverrides: { colleges: [STILL_EXPLORING_LABEL] }
  });
  assert.equal(validatePreludeMatchPayload(exploring, PRELUDE_MATCH_QUESTIONS).ok, true);
  assert.equal(exploring.answers.colleges.stillExploring, true);
});

test("optional unanswered questions render No answer provided and HTML is escaped", () => {
  const payload = validPayload({ answerOverrides: { biggestQuestion: undefined } });
  delete payload.answers.biggestQuestion;
  payload.answers.biggestQuestion = "<script>alert(1)</script>";
  const email = buildPreludeMatchEmail({
    payload: validPayload({ answerOverrides: { biggestQuestion: "" } }),
    questionDefs: PRELUDE_MATCH_QUESTIONS,
    verifiedUserId: "u1",
    verifiedEmail: "a@b.com",
    notificationEmail: "prelude@preludeconsultingllc.com"
  });
  assert.match(email.text, /No answer provided/);

  const escaped = buildPreludeMatchEmail({
    payload,
    questionDefs: PRELUDE_MATCH_QUESTIONS,
    verifiedUserId: "u1",
    verifiedEmail: "a@b.com",
    notificationEmail: "prelude@preludeconsultingllc.com"
  });
  assert.match(escaped.html, /&lt;script&gt;/);
  assert.doesNotMatch(escaped.html, /<script>alert\(1\)<\/script>/);
});

test("serializeCollegesAnswer strips custom schools", () => {
  assert.deepEqual(serializeCollegesAnswer(["ha", "custom school"]), {
    stillExploring: false,
    collegeIds: []
  });
  assert.deepEqual(serializeCollegesAnswer([STILL_EXPLORING_LABEL]), {
    stillExploring: true,
    collegeIds: []
  });
});

test("no DB migration / Prisma model / Storage write paths in send-prelude-match", () => {
  const fn = fs.readFileSync(
    path.join(process.cwd(), "supabase/functions/send-prelude-match/index.ts"),
    "utf8"
  );
  assert.doesNotMatch(fn, /\.from\(/);
  assert.doesNotMatch(fn, /storage\.from/);
  assert.doesNotMatch(fn, /prisma/i);
  assert.doesNotMatch(fn, /\.insert\(/);
  assert.doesNotMatch(fn, /\.upsert\(/);
  assert.doesNotMatch(fn, /console\.(?:log|error|warn)\(\s*[`'"].*answers/);
  assert.doesNotMatch(fn, /JSON\.stringify\(\s*payload\s*\)/);
  assert.match(fn, /Idempotency-Key/);
  assert.match(fn, /PRELUDE_MATCH_NOTIFICATION_EMAIL/);
  assert.match(fn, /PRELUDE_MATCH_FROM_EMAIL/);
  assert.match(fn, /RESEND_API_KEY/);
});

test("frontend submit helper does not embed Resend secrets", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/preludeMatchSubmit.js"), "utf8");
  assert.doesNotMatch(src, /RESEND_API_KEY/);
  assert.doesNotMatch(src, /re_[A-Za-z0-9]/);
  assert.match(src, /functions\.invoke\(\s*"send-prelude-match"/);
  assert.match(src, /sessionStorage/);
  assert.match(src, /prelude_match_submission_attempt_id/);
  assert.doesNotMatch(src, /localStorage/);
});

test("markMatchQuestionnaireComplete ignores answer persistence", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/preludeMatchService.js"), "utf8");
  assert.match(src, /questionnaire_answers:\s*\{\}/);
  assert.match(src, /markMatchQuestionnaireComplete/);
});
