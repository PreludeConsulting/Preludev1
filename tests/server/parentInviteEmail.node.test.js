#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildAuthUrl, deliverParentInviteEmail } from "../../server/lib/authEmail.js";

async function main() {
  const workerEnv = {
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test_key",
    AUTH_EMAIL_FROM: "Prelude <no-reply@example.com>",
    PUBLIC_APP_URL: "https://preludeconsultingllc.com"
  };

  const req = {
    headers: {
      host: "preludeconsultingllc.com",
      "x-forwarded-host": "preludeconsultingllc.com",
      "x-forwarded-proto": "https"
    }
  };

  const originalProcess = globalThis.process;
  try {
    // Cloudflare Workers do not expose Node's `process` global.
    Reflect.deleteProperty(globalThis, "process");

    const url = buildAuthUrl(
      req,
      "/register?parentInvite=abc123def456&role=parent",
      workerEnv
    );
    assert.equal(url, "https://preludeconsultingllc.com/register?parentInvite=abc123def456&role=parent");

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    };

    const result = await deliverParentInviteEmail({
      to: "parent@example.com",
      studentName: "Jordan",
      url,
      req,
      env: workerEnv
    });

    assert.equal(fetchCalled, true);
    assert.equal(result.delivered, true);

    globalThis.fetch = originalFetch;
  } finally {
    if (originalProcess) {
      globalThis.process = originalProcess;
    }
  }

  console.log("parentInviteEmail worker-env tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
