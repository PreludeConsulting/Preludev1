import assert from "node:assert/strict";
import test from "node:test";
import { bugReportSchema, sendBugReport } from "../../server/lib/bugReports.js";

test("bug report schema requires category, title, and description", () => {
  assert.equal(bugReportSchema.safeParse({}).success, false);
  assert.equal(bugReportSchema.safeParse({ category: "Dashboard issue", title: "Broken card", description: "The overview card does not load." }).success, true);
});

test("bug report sends the expected support email without exposing provider config", async () => {
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ id: "email_123" }) };
  };
  try {
    const result = await sendBugReport({
      env: { RESEND_API_KEY: "server-secret", AUTH_EMAIL_FROM: "Prelude <support@example.com>", BUG_REPORT_EMAIL: "bugs@example.com" },
      payload: { category: "Messaging issue", title: "Message stuck", description: "The message remains in the sending state.", pageUrl: "https://example.com/messages", userAgent: "Test Browser" },
      verifiedAccount: { name: "Test Student", email: "student@example.com", role: "student", userId: "user_123" }
    });
    assert.equal(result.message, "Thanks — your bug report was sent to Prelude Support.");
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.deepEqual(request.body.to, ["bugs@example.com"]);
    assert.equal(request.body.subject, "[Prelude Bug Report] Messaging issue - Message stuck");
    assert.match(request.body.html, /Test Student/);
    assert.doesNotMatch(JSON.stringify(request.body), /server-secret/);
  } finally {
    global.fetch = previousFetch;
  }
});
