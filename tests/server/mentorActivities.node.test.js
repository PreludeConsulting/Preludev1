#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  canAccessActivity,
  createMentorActivitiesApiMiddleware,
  displayActivityStatus,
  resolveActivityFileType,
  sanitizeActivityFileName,
  validateDocumentUrl
} from "../../server/mentorActivitiesApi.js";

const studentA = "11111111-1111-4111-a111-111111111111";
const studentB = "22222222-2222-4222-a222-222222222222";
const mentorA = "33333333-3333-4333-a333-333333333333";
const mentorB = "44444444-4444-4444-a444-444444444444";
const activity = { student_id: studentA, mentor_id: mentorA, status: "not_started" };

assert.equal(canAccessActivity({ role: "student", userId: studentA, activity }), true);
assert.equal(canAccessActivity({ role: "student", userId: studentB, activity }), false);
assert.equal(canAccessActivity({ role: "mentor", userId: mentorA, activity, writeAsMentor: true }), true);
assert.equal(canAccessActivity({ role: "mentor", userId: mentorB, activity, writeAsMentor: true }), false);
assert.equal(canAccessActivity({ role: "admin", userId: mentorB, activity, writeAsMentor: true }), true);
assert.equal(canAccessActivity({ role: "parent", userId: studentA, activity }), false);

assert.equal(validateDocumentUrl("https://docs.google.com/document/d/example"), true);
assert.equal(validateDocumentUrl("file:///etc/passwd"), false);
assert.equal(resolveActivityFileType("draft.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")?.extension, "docx");
assert.equal(resolveActivityFileType("draft.pdf.exe", "application/pdf"), null);
assert.equal(sanitizeActivityFileName("../../My Essay (final).pdf"), "My_Essay_final_.pdf");
assert.equal(displayActivityStatus({ status: "not_started", due_date: "2020-01-01T00:00:00.000Z" }, new Date("2021-01-01T00:00:00.000Z")), "overdue");
assert.equal(displayActivityStatus({ status: "submitted", due_date: "2020-01-01T00:00:00.000Z" }, new Date("2021-01-01T00:00:00.000Z")), "submitted");

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value || ""; }
  };
}

const unauthenticated = new Error("Authentication required.");
unauthenticated.statusCode = 401;
const middleware = createMentorActivitiesApiMiddleware({
  requireUser: async () => { throw unauthenticated; },
  getAdmin: () => null,
  env: {}
});
const response = mockResponse();
await middleware({ url: "/api/activities", method: "GET", headers: {} }, response, () => {});
assert.equal(response.statusCode, 401);
assert.equal(JSON.parse(response.body).error, "unauthenticated");

let passedThrough = false;
await middleware({ url: "/api/other", method: "GET", headers: {} }, mockResponse(), () => { passedThrough = true; });
assert.equal(passedThrough, true);

console.log("mentorActivities.node.test.js: ok");
