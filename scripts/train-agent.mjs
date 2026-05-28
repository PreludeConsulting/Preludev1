#!/usr/bin/env node
/**
 * Repetition training — runs the agent test suite multiple rounds via Vitest.
 * Usage: npm run train:agent [-- --rounds=5]
 */
import { spawnSync } from "node:child_process";

const rounds = Number(process.argv.find((a) => a.startsWith("--rounds="))?.split("=")[1] ?? 3);

let failed = 0;

for (let r = 1; r <= rounds; r++) {
  console.log(`\n—— Round ${r}/${rounds} ——\n`);
  const result = spawnSync("npx", ["vitest", "run", "tests/agent/preludeAgent.test.js"], {
    stdio: "inherit",
    shell: true
  });
  if (result.status !== 0) failed++;
}

console.log(`\nTraining complete: ${rounds - failed}/${rounds} rounds passed.\n`);
process.exit(failed > 0 ? 1 : 0);
