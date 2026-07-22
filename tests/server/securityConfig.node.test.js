#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicAppUrl } from "../../server/lib/authEmail.js";
import { getAppBaseUrl } from "../../server/billingConfig.js";
import { getJwtSecret } from "../../server/authApi.js";

const hostileRequest = {
  headers: {
    host: "attacker.example",
    "x-forwarded-host": "attacker.example",
    "x-forwarded-proto": "https"
  }
};

test("production auth links require an explicit trusted public app URL", () => {
  assert.throws(
    () => resolvePublicAppUrl(hostileRequest, { NODE_ENV: "production" }),
    /PUBLIC_APP_URL/
  );
  assert.equal(
    resolvePublicAppUrl(hostileRequest, {
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://preludeconsultingllc.com/"
    }),
    "https://preludeconsultingllc.com"
  );
});

test("production billing redirects never trust forwarded host headers", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    VITE_PUBLIC_APP_URL: process.env.VITE_PUBLIC_APP_URL
  };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_APP_URL;
    delete process.env.VITE_PUBLIC_APP_URL;
    assert.throws(() => getAppBaseUrl(hostileRequest), /PUBLIC_APP_URL/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("production JWT signing fails closed when no secret is configured", () => {
  assert.throws(
    () => getJwtSecret({ NODE_ENV: "production" }),
    /JWT_ACCESS_SECRET|JWT_SECRET/
  );
  assert.equal(getJwtSecret({ NODE_ENV: "production", JWT_ACCESS_SECRET: "configured-secret" }), "configured-secret");
});
