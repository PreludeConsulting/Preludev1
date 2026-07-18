import assert from "node:assert/strict";
import test from "node:test";
import { handleBugReport } from "../../functions/_lib/bugReports.js";
import { resetIpRateLimitBuckets } from "../../server/lib/ipRateLimit.js";

const validPayload = {
  category: "Dashboard issue",
  title: "Testig",
  description: "asdasdsadasdwgrsd",
  pageUrl: "https://preludeconsultingllc.com/"
};

function context(env = {}) {
  return {
    env,
    request: new Request("https://preludeconsultingllc.com/api/support/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
      body: JSON.stringify(validPayload)
    })
  };
}

test.beforeEach(resetIpRateLimitBuckets);

test("Cloudflare bug report handler identifies missing email configuration", async () => {
  const response = await handleBugReport(context({ NODE_ENV: "development" }));
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "email_not_configured");
  assert.equal(body.debugMessage, "Bug report email could not be delivered.");
});

test("Cloudflare bug report handler sends with its context Resend bindings", async () => {
  const previousFetch = global.fetch;
  let emailRequest;
  global.fetch = async (url, options) => {
    emailRequest = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ id: "email_worker_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await handleBugReport(context({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_existing_server_key",
      AUTH_EMAIL_FROM: "Prelude <no-reply@preludeconsultingllc.com>",
      BUG_REPORT_EMAIL: "preludesupport@preludeconsultingllc.com"
    }));
    assert.equal(response.status, 200);
    assert.equal(emailRequest.url, "https://api.resend.com/emails");
    assert.equal(emailRequest.body.from, "Prelude <no-reply@preludeconsultingllc.com>");
    assert.deepEqual(emailRequest.body.to, ["preludesupport@preludeconsultingllc.com"]);
  } finally {
    global.fetch = previousFetch;
  }
});
