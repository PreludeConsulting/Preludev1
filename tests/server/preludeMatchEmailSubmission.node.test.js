/**
 * Prelude Match submission helpers + API wiring.
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
  resolvePreludeMatchEmailConfig,
  serializeCollegesAnswer,
  toDisplayQuestionnaireAnswers,
  validatePreludeMatchPayload
} from "../../shared/preludeMatchSubmission.js";
import { processPreludeMatchSubmission } from "../../server/lib/preludeMatchSubmit.js";

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

function mockAdmin({ existing = null } = {}) {
  const rows = new Map();
  if (existing) rows.set(existing.submission_id, { ...existing });
  const onboarding = [];

  return {
    onboarding,
    rows,
    from(table) {
      const state = { table, filters: {}, payload: null, op: "select" };

      const resolve = async () => {
        if (state.table === "prelude_match_submissions") {
          if (state.op === "upsert") {
            const id = state.payload.submission_id;
            const next = { id: rows.get(id)?.id || "row-1", ...rows.get(id), ...state.payload };
            rows.set(id, next);
            return { data: next, error: null };
          }
          const id = state.filters.submission_id;
          return { data: rows.get(id) || null, error: null };
        }
        if (state.table === "onboarding_progress" && state.op === "upsert") {
          onboarding.push(state.payload);
          return { data: state.payload, error: null };
        }
        return { data: null, error: null };
      };

      const api = {
        select() {
          if (state.op !== "upsert") state.op = "select";
          return api;
        },
        eq(col, val) {
          state.filters[col] = val;
          return api;
        },
        upsert(payload) {
          state.op = "upsert";
          state.payload = payload;
          return api;
        },
        maybeSingle: resolve,
        then(onFulfilled, onRejected) {
          return resolve().then(onFulfilled, onRejected);
        }
      };
      return api;
    }
  };
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

test("resolvePreludeMatchEmailConfig prefers documented names and defaults recipient", () => {
  const cfg = resolvePreludeMatchEmailConfig({
    RESEND_API_KEY: "re_test",
    PRELUDE_FROM_EMAIL: "Prelude <no-reply@preludeconsultingllc.com>"
  });
  assert.equal(cfg.toEmail, "prelude@preludeconsultingllc.com");
  assert.equal(cfg.configured, true);

  const legacy = resolvePreludeMatchEmailConfig({
    RESEND_API_KEY: "re_test",
    PRELUDE_MATCH_NOTIFICATION_EMAIL: "team@example.com",
    AUTH_EMAIL_FROM: "Prelude <no-reply@preludeconsultingllc.com>"
  });
  assert.equal(legacy.toEmail, "team@example.com");
  assert.equal(legacy.fromEmail, "Prelude <no-reply@preludeconsultingllc.com>");
});

test("toDisplayQuestionnaireAnswers expands college ids for admin UI", () => {
  const display = toDisplayQuestionnaireAnswers({
    grade: "11th grade",
    colleges: { stillExploring: false, collegeIds: ["harvard"] }
  });
  assert.equal(display.colleges[0].name, "Harvard University");
  assert.deepEqual(
    toDisplayQuestionnaireAnswers({ colleges: { stillExploring: true, collegeIds: [] } }).colleges,
    [STILL_EXPLORING_LABEL]
  );
});

test("processPreludeMatchSubmission persists then emails and is idempotent on retry", async () => {
  const admin = mockAdmin();
  let resendCalls = 0;
  const fetchImpl = async () => {
    resendCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "email_123" })
    };
  };

  const env = {
    RESEND_API_KEY: "re_test",
    PRELUDE_MATCH_RECIPIENT: "prelude@preludeconsultingllc.com",
    PRELUDE_FROM_EMAIL: "Prelude <no-reply@preludeconsultingllc.com>"
  };
  const user = { id: "user-1", email: "student@example.com" };
  const payload = validPayload();

  const first = await processPreludeMatchSubmission({ env, user, payload, fetchImpl, admin });
  assert.equal(first.success, true);
  assert.equal(first.emailId, "email_123");
  assert.equal(resendCalls, 1);
  assert.equal(admin.rows.get(payload.submissionId).email_status, "sent");
  assert.equal(admin.onboarding.length, 1);
  assert.ok(Object.keys(admin.onboarding[0].questionnaire_answers).length > 0);

  const second = await processPreludeMatchSubmission({ env, user, payload, fetchImpl, admin });
  assert.equal(second.success, true);
  assert.equal(second.alreadySubmitted, true);
  assert.equal(resendCalls, 1);
});

test("processPreludeMatchSubmission keeps DB row failed when Resend fails", async () => {
  const admin = mockAdmin();
  const fetchImpl = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ message: "boom" })
  });
  const env = {
    RESEND_API_KEY: "re_test",
    PRELUDE_FROM_EMAIL: "Prelude <no-reply@preludeconsultingllc.com>"
  };

  await assert.rejects(
    () =>
      processPreludeMatchSubmission({
        env,
        user: { id: "user-1", email: "student@example.com" },
        payload: validPayload(),
        fetchImpl,
        admin
      }),
    /provider unavailable|still here|couldn’t submit/i
  );
  assert.equal(admin.rows.get("11111111-1111-4111-8111-111111111111").email_status, "failed");
  assert.equal(admin.onboarding.length, 0);
});

test("processPreludeMatchSubmission rejects missing env and invalid payloads", async () => {
  await assert.rejects(
    () =>
      processPreludeMatchSubmission({
        env: {},
        user: { id: "user-1", email: "student@example.com" },
        payload: validPayload(),
        admin: mockAdmin()
      }),
    /not configured/i
  );

  await assert.rejects(
    () =>
      processPreludeMatchSubmission({
        env: {
          RESEND_API_KEY: "re_test",
          PRELUDE_FROM_EMAIL: "Prelude <no-reply@preludeconsultingllc.com>"
        },
        user: { id: "user-1", email: "student@example.com" },
        payload: {},
        admin: mockAdmin()
      }),
    /Invalid Prelude Match submission/
  );
});

test("Cloudflare route and env example wire Prelude Match submit", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "functions/api/prelude-match/submit.js"),
    "utf8"
  );
  assert.match(route, /handlePreludeMatchSubmit/);

  const fn = fs.readFileSync(
    path.join(process.cwd(), "supabase/functions/send-prelude-match/index.ts"),
    "utf8"
  );
  assert.match(fn, /PRELUDE_MATCH_RECIPIENT|PRELUDE_MATCH_NOTIFICATION_EMAIL/);
  assert.match(fn, /PRELUDE_FROM_EMAIL|PRELUDE_MATCH_FROM_EMAIL|AUTH_EMAIL_FROM/);
  assert.match(fn, /RESEND_API_KEY/);
  assert.match(fn, /prelude_match_submissions/);
  assert.match(fn, /Idempotency-Key/);

  const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
  assert.match(envExample, /PRELUDE_MATCH_RECIPIENT=prelude@preludeconsultingllc\.com/);
  assert.match(envExample, /PRELUDE_FROM_EMAIL=/);
});

test("frontend submit helper posts to secure API and does not embed Resend secrets", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/preludeMatchSubmit.js"), "utf8");
  assert.doesNotMatch(src, /RESEND_API_KEY/);
  assert.doesNotMatch(src, /re_[A-Za-z0-9]/);
  assert.match(src, /\/api\/prelude-match\/submit/);
  assert.match(src, /sessionStorage/);
  assert.match(src, /prelude_match_submission_attempt_id/);
  assert.doesNotMatch(src, /localStorage/);
});

test("markMatchQuestionnaireComplete preserves questionnaire answers", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/preludeMatchService.js"), "utf8");
  assert.doesNotMatch(src, /questionnaire_answers:\s*\{\}/);
  assert.match(src, /markMatchQuestionnaireComplete/);
  assert.match(src, /preservedAnswers/);
});
