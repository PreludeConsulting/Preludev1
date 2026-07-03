#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  contactBookingSchema,
  easternDateTimeToUtc,
  sendContactEmail
} from "../../server/lib/contactBookings.js";

async function main() {
  assert.equal(easternDateTimeToUtc("2026-07-06", "10:00").toISOString(), "2026-07-06T14:00:00.000Z");
  assert.equal(easternDateTimeToUtc("2026-01-12", "10:00").toISOString(), "2026-01-12T15:00:00.000Z");

  const parsed = contactBookingSchema.parse({
    selectedDate: "2026-07-06",
    selectedTime: "10:00",
    name: "Jordan Lee",
    email: "JORDAN@example.com",
    phone: "",
    studentYear: "11th grade",
    topic: "Essay strategy"
  });
  assert.equal(parsed.name, "Jordan Lee");
  assert.equal(parsed.email, "JORDAN@example.com");

  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };

  const result = await sendContactEmail({
    env: {
      RESEND_API_KEY: "re_test_key",
      AUTH_EMAIL_FROM: "Prelude <no-reply@example.com>"
    },
    to: "student@example.com",
    subject: "Test email",
    html: "<p>Hello</p>"
  });

  assert.equal(result.delivered, true);
  assert.equal(result.id, "email_123");
  assert.deepEqual(requestBody.to, ["student@example.com"]);
  assert.equal(requestBody.subject, "Test email");
  globalThis.fetch = originalFetch;

  console.log("contactBookings tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
