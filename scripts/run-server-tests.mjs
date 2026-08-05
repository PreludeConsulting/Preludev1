/**
 * Runs Node server tests while Prelude AI is disabled.
 * AI / college-dataset suites stay out of the default path — use `npm run test:ai`.
 */

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const serverTestDir = path.join(root, "tests", "server");

/** Suites that require the college dataset DB and/or live AI stack. */
const PRELUDE_AI_TEST_FILES = new Set([
  "collegeChat.node.test.js",
  "chatImprovements.node.test.js",
  "retrievalAnswer.node.test.js",
  "datasets.node.test.js",
  "collegeRecommendations.node.test.js",
  "fallback.node.test.js"
]);

const files = readdirSync(serverTestDir)
  .filter((name) => name.endsWith(".node.test.js"))
  .filter((name) => !PRELUDE_AI_TEST_FILES.has(name))
  .map((name) => path.join(serverTestDir, name))
  .sort();

if (!files.length) {
  console.error("No non-AI server tests found.");
  process.exit(1);
}

console.log(`[server-tests] skipping ${PRELUDE_AI_TEST_FILES.size} Prelude AI suites (use npm run test:ai)`);
console.log(`[server-tests] running ${files.length} suites`);

const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", ...files],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env
  }
);

process.exit(result.status ?? 1);
