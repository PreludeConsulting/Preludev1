#!/usr/bin/env node
/**
 * Reset local repo to match origin/main and remove merged local branches.
 * Run before starting new work: npm run sync:main
 */
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

run("git fetch origin --prune");
run("git checkout main");
run("git reset --hard origin/main");

const merged = execSync("git branch --merged main", { encoding: "utf8" })
  .split("\n")
  .map((b) => b.replace(/^\*?\s+/, "").trim())
  .filter((b) => b && b !== "main");

for (const branch of merged) {
  try {
    run(`git branch -D ${branch}`);
  } catch {
    // ignore branches that cannot be deleted
  }
}

run("git remote prune origin");
console.log("\nReady on main:", execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim());
