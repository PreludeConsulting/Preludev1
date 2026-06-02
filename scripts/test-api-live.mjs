#!/usr/bin/env node
/**
 * Hit a running Vite dev server (default http://localhost:5173).
 * Usage: node scripts/test-api-live.mjs [baseUrl]
 */

import assert from "node:assert/strict";

const defaultBase =
  process.env.PRELUDE_API_BASE ?? (process.env.PRELUDE_API_PORT ? `http://localhost:${process.env.PRELUDE_API_PORT}` : "http://localhost:5173");
const base = (process.argv[2] ?? defaultBase).replace(/\/$/, "");

async function get(path) {
  const response = await fetch(`${base}${path}`);
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

const college = await get("/api/colleges/search?state=GA&major=computer%20science&limit=5");
assert.equal(college.status, 200);
assert.ok(college.json.results?.length > 0);

const capped = await get("/api/colleges/search?state=GA&limit=99");
assert.equal(capped.status, 200);
assert.equal(capped.json.limit, 25);

const program = await get("/api/programs/search?q=computer%20science&state=GA&limit=5");
assert.equal(program.status, 200);

const career = await get("/api/careers/search?q=software%20developer&limit=5");
assert.equal(career.status, 200);

const missing = await get("/api/colleges/000000");
assert.equal(missing.status, 404);

const chat = await post("/api/chat", {
  message: "What is Early Decision?",
  conversationHistory: []
});
assert.ok(chat.status === 200 || chat.status === 503);
if (chat.status === 200) assert.ok(chat.json.text?.length > 0);

console.log(`Live API checks passed against ${base}`);
