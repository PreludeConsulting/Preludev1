#!/usr/bin/env node
/**
 * Smoke-test dataset API handlers without starting Vite.
 * Usage: node scripts/test-api-routes.mjs
 */

import assert from "node:assert/strict";
import { createDatasetsApiMiddleware } from "../server/datasetsApi.js";
import { getAiProvider } from "../server/aiConfig.js";
import { createRagChatCompletion } from "../server/chatHandler.js";

function mockReq(url, method = "GET") {
  return {
    method,
    url,
    on() {
      return this;
    }
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload ?? "";
    }
  };
  return res;
}

async function invoke(middleware, url, method = "GET") {
  const req = mockReq(url, method);
  const res = mockRes();
  await new Promise((resolve) => {
    middleware(req, res, resolve);
  });
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
}

async function main() {
  const middleware = createDatasetsApiMiddleware();

  const collegeSearch = await invoke(
    middleware,
    "/api/colleges/search?state=GA&major=computer%20science&limit=5"
  );
  assert.equal(collegeSearch.status, 200);
  assert.ok(collegeSearch.json.results.length > 0);

  const programSearch = await invoke(
    middleware,
    "/api/programs/search?q=computer%20science&state=GA&limit=5"
  );
  assert.equal(programSearch.status, 200);
  assert.ok(programSearch.json.results.length > 0);

  const careerSearch = await invoke(middleware, "/api/careers/search?q=software%20developer&limit=5");
  assert.equal(careerSearch.status, 200);
  assert.ok(careerSearch.json.results.length > 0);

  const invalidLimit = await invoke(middleware, "/api/colleges/search?limit=0");
  assert.equal(invalidLimit.status, 400);

  const missingCollege = await invoke(middleware, "/api/colleges/000000");
  assert.equal(missingCollege.status, 404);

  const emptySearch = await invoke(middleware, "/api/colleges/search?q=");
  assert.equal(emptySearch.status, 200);
  assert.equal(emptySearch.json.count, 0);

  const provider = getAiProvider();
  try {
    await createRagChatCompletion({
      message: "What is Early Decision?",
      conversationHistory: []
    });
    console.log(`chat: completed with provider=${provider}`);
  } catch (error) {
    if (provider === "ollama") {
      assert.ok(["OLLAMA_NOT_RUNNING", "OLLAMA_MODEL_NOT_FOUND", "UPSTREAM_ERROR"].includes(error.code));
      console.log(`chat: ollama check (${error.code})`);
    } else {
      assert.equal(error.code, "NOT_CONFIGURED");
      console.log("chat: not_configured (expected without OPENAI_API_KEY)");
    }
  }

  console.log("API route smoke tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
